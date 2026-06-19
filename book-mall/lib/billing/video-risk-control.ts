/**
 * 视频专项风控（财务 2.0 · Phase 3）
 *
 * 防刷/防爆量，保护视频毛利与厂商额度：
 *  - 单账号并发 2 / 队列上限 10
 *  - 单日条数上限（按会员档）
 *  - 单次批量 ≤5 集
 *  - 5 分钟内 ≥10 条 → 15 分钟冷却
 *  - 异常用户阶梯管控（弹窗 → 次日减半 → 关批量 → 封视频权限）
 *
 * 依赖 Redis；未配置 REDIS_URL 时整体降级放行（与并发限流一致），纯阈值判断仍可单测。
 */
import { prisma } from "@/lib/prisma";
import {
  acquireSlot,
  getCount,
  getFlag,
  getFlagTtl,
  incrWithWindow,
  isConcurrencyEnabled,
  releaseSlot,
  setFlag,
} from "@/lib/redis-service";
import { resolveBillingRef } from "./credit-pre-check";

// ——————————————————— 阈值（纯常量，可单测） ———————————————————
/** @deprecated 请用 getVideoPersonalMaxConcurrency()；保留常量供单测与文档引用 */
export const VIDEO_MAX_CONCURRENCY = 2;
/** @deprecated 请用 getVideoPersonalMaxQueue() */
export const VIDEO_MAX_QUEUE = 10;

/** 个人账号同时渲染上限（环境变量 VIDEO_MAX_CONCURRENCY，默认 2） */
export function getVideoPersonalMaxConcurrency(): number {
  const raw = Number(process.env.VIDEO_MAX_CONCURRENCY ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : VIDEO_MAX_CONCURRENCY;
}

/** 个人账号排队上限（环境变量 VIDEO_MAX_QUEUE，默认 10） */
export function getVideoPersonalMaxQueue(): number {
  const raw = Number(process.env.VIDEO_MAX_QUEUE ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : VIDEO_MAX_QUEUE;
}

/** 团队排队深度 = maxConcurrency × 倍数（默认 5，即 15 并发 → 75 排队） */
export function getVideoTeamQueueMultiplier(): number {
  const raw = Number(process.env.VIDEO_TEAM_QUEUE_MULTIPLIER ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 5;
}

export type VideoRiskLimits = {
  accountId: string;
  tier: string | null;
  maxConcurrency: number;
  maxQueue: number;
  billingOwnerType: "USER" | "TENANT";
};

export function resolveVideoLimitsFromBilling(input: {
  ownerType: "USER" | "TENANT";
  ownerId: string;
  tier: string | null;
  tenantMaxConcurrency?: number | null;
}): VideoRiskLimits {
  if (input.ownerType === "TENANT") {
    const maxConcurrency = Math.max(1, Math.round(input.tenantMaxConcurrency ?? 2));
    const mult = getVideoTeamQueueMultiplier();
    return {
      accountId: input.ownerId,
      tier: input.tier,
      maxConcurrency,
      maxQueue: maxConcurrency * mult,
      billingOwnerType: "TENANT",
    };
  }
  return {
    accountId: input.ownerId,
    tier: input.tier,
    maxConcurrency: getVideoPersonalMaxConcurrency(),
    maxQueue: getVideoPersonalMaxQueue(),
    billingOwnerType: "USER",
  };
}

export const VIDEO_BATCH_MAX = 5; // 单次批量（批量生成集数）上限
export const VIDEO_BURST_WINDOW_SEC = 5 * 60; // 突发统计窗口
export const VIDEO_BURST_THRESHOLD = 10; // 窗口内触发冷却的条数
export const VIDEO_COOLDOWN_SEC = 15 * 60; // 冷却时长
export const VIDEO_SLOT_TTL_SEC = 30 * 60; // 并发/队列槽兜底过期

/** 单日条数上限（按会员档）。未知档用保守默认。 */
export const VIDEO_DAILY_CAP_BY_TIER: Record<string, number> = {
  标准版: 30,
  进阶版: 90,
  高级版: 200,
  豪华版: 400,
  至尊版: 800,
};
export const VIDEO_DAILY_CAP_DEFAULT = 30;

export function videoDailyCapForTier(tier?: string | null): number {
  if (!tier) return VIDEO_DAILY_CAP_DEFAULT;
  return VIDEO_DAILY_CAP_BY_TIER[tier] ?? VIDEO_DAILY_CAP_DEFAULT;
}

/** 批量集数是否超限（纯函数）。 */
export function exceedsBatchLimit(count: number): boolean {
  return Math.round(count) > VIDEO_BATCH_MAX;
}

/** 异常用户管控阶梯（递进）。 */
export type RiskLevel = "NONE" | "POPUP" | "HALVE_NEXT_DAY" | "DISABLE_BATCH" | "BAN_VIDEO";
const RISK_LADDER: RiskLevel[] = ["NONE", "POPUP", "HALVE_NEXT_DAY", "DISABLE_BATCH", "BAN_VIDEO"];

/** 阶梯下一级（纯函数）。 */
export function nextRiskLevel(level: RiskLevel): RiskLevel {
  const i = RISK_LADDER.indexOf(level);
  return RISK_LADDER[Math.min(i + 1, RISK_LADDER.length - 1)];
}

// ——————————————————— 异常类型 ———————————————————
export type VideoRiskReason =
  | "BATCH_TOO_LARGE"
  | "CONCURRENCY"
  | "QUEUE_FULL"
  | "DAILY_CAP"
  | "COOLDOWN"
  | "BANNED";

export class VideoRiskError extends Error {
  constructor(
    public readonly reason: VideoRiskReason,
    message: string,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "VideoRiskError";
  }
}

// ——————————————————— 键 ———————————————————
const acctKey = (id: string) => `video:${id}`;
const concKey = (id: string) => `${acctKey(id)}:conc`;
const queueKey = (id: string) => `${acctKey(id)}:queue`;
const burstKey = (id: string) => `${acctKey(id)}:burst`;
const cooldownKey = (id: string) => `${acctKey(id)}:cooldown`;
const riskKey = (id: string) => `${acctKey(id)}:risk`;
function dailyKey(id: string): string {
  const d = new Date();
  const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `${acctKey(id)}:daily:${day}`;
}

/**
 * 视频发起前的综合风控校验（在冻结预扣前调用）。无 Redis 时放行。
 * @param accountId  计费账户标识（userId 或 tenantId）
 * @param tier       会员档（决定单日上限）
 * @param batchCount 本次批量集数（默认 1）
 */
export async function assertVideoAllowed(input: {
  accountId: string;
  tier?: string | null;
  batchCount?: number;
  maxQueue?: number;
}): Promise<{ popupMessage?: string }> {
  const batch = Math.max(1, Math.round(input.batchCount ?? 1));
  const maxQueue = Math.max(1, Math.round(input.maxQueue ?? getVideoPersonalMaxQueue()));
  // 批量上限：纯阈值，始终生效（不依赖 Redis）
  if (exceedsBatchLimit(batch)) {
    throw new VideoRiskError("BATCH_TOO_LARGE", `单次批量最多 ${VIDEO_BATCH_MAX} 集，当前 ${batch}`);
  }

  if (!isConcurrencyEnabled()) return {};

  const id = input.accountId;

  // 风控阶梯：封视频权限直接拒绝
  const risk = (await getFlag(riskKey(id))) as RiskLevel | null;
  if (risk === "BAN_VIDEO") {
    throw new VideoRiskError("BANNED", "账号视频权限已被风控暂停，请联系客服");
  }
  if (risk === "DISABLE_BATCH" && batch > 1) {
    throw new VideoRiskError("BATCH_TOO_LARGE", "账号风控期内已关闭批量生成，请逐条生成");
  }

  let popupMessage: string | undefined;
  if (risk === "POPUP") {
    popupMessage =
      "系统检测到您的视频生成频率异常，请合理使用；继续生成即表示您已知晓相关规则。";
  }

  // 冷却中
  const cd = await getFlagTtl(cooldownKey(id));
  if (cd != null && cd > 0) {
    throw new VideoRiskError("COOLDOWN", `触发频控冷却，请 ${Math.ceil(cd / 60)} 分钟后再试`, cd);
  }

  // 单日条数上限（按档；阶梯 HALVE_NEXT_DAY 时减半）
  const baseCap = videoDailyCapForTier(input.tier);
  const cap = risk === "HALVE_NEXT_DAY" ? Math.ceil(baseCap / 2) : baseCap;
  const used = (await getCount(dailyKey(id))) ?? 0;
  if (used + batch > cap) {
    throw new VideoRiskError("DAILY_CAP", `今日视频条数已达上限（${cap}），请明日再试`);
  }

  // 队列上限（含渲染中）
  const queued = (await getCount(queueKey(id))) ?? 0;
  if (queued + batch > maxQueue) {
    throw new VideoRiskError("QUEUE_FULL", `排队任务已满（${maxQueue}），请稍后再试`);
  }

  return { popupMessage };
}

/**
 * 占用一个并发渲染槽（在实际调厂商前）。超并发抛 CONCURRENCY。无 Redis 放行。
 */
export async function acquireVideoConcurrency(
  accountId: string,
  maxConcurrency = getVideoPersonalMaxConcurrency(),
): Promise<void> {
  if (!isConcurrencyEnabled()) return;
  const max = Math.max(1, Math.round(maxConcurrency));
  const r = await acquireSlot({ key: concKey(accountId), max, ttlSec: VIDEO_SLOT_TTL_SEC });
  if (!r.ok) {
    throw new VideoRiskError("CONCURRENCY", `同时渲染任务过多（上限 ${max}），请稍后再试`);
  }
}

/** 释放并发渲染槽（任务结束时）。 */
export async function releaseVideoConcurrency(accountId: string): Promise<void> {
  if (!isConcurrencyEnabled()) return;
  await releaseSlot(concKey(accountId));
}

/**
 * 登记一次视频提交（成功通过风控后调用）：
 *  - 当日计数 +batch（窗口 = 当日到期）
 *  - 队列计数 +batch
 *  - 突发窗口 +batch；达到阈值则置冷却标记
 */
export async function recordVideoSubmission(input: {
  accountId: string;
  batchCount?: number;
}): Promise<void> {
  if (!isConcurrencyEnabled()) return;
  const id = input.accountId;
  const batch = Math.max(1, Math.round(input.batchCount ?? 1));
  for (let i = 0; i < batch; i++) {
    await incrWithWindow(dailyKey(id), 24 * 60 * 60);
    await incrWithWindow(queueKey(id), VIDEO_SLOT_TTL_SEC);
    const burst = await incrWithWindow(burstKey(id), VIDEO_BURST_WINDOW_SEC);
    if (burst != null && burst >= VIDEO_BURST_THRESHOLD) {
      await setFlag(cooldownKey(id), "1", VIDEO_COOLDOWN_SEC);
    }
  }
}

/** 任务结束（成功/失败）释放队列计数。 */
export async function releaseVideoQueue(accountId: string): Promise<void> {
  if (!isConcurrencyEnabled()) return;
  await releaseSlot(queueKey(accountId));
}

/** 异常用户阶梯升级一级（运营/风控触发），返回新等级。 */
export async function escalateAbnormalUser(accountId: string, ttlSec = 24 * 60 * 60): Promise<RiskLevel> {
  const cur = ((await getFlag(riskKey(accountId))) as RiskLevel | null) ?? "NONE";
  const next = nextRiskLevel(cur);
  await setFlag(riskKey(accountId), next, ttlSec);
  return next;
}

/** 查询当前风控等级。 */
export async function getRiskLevel(accountId: string): Promise<RiskLevel> {
  return ((await getFlag(riskKey(accountId))) as RiskLevel | null) ?? "NONE";
}

// ——————————————————— 生成链路集成（按 apiKey/tenant 解析账户与档位） ———————————————————

/** 解析生成上下文 → 风控账户 + 并发/队列上限（团队对齐 Tenant.maxConcurrency）。 */
export async function resolveVideoRiskLimits(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
}): Promise<VideoRiskLimits | null> {
  const ref = await resolveBillingRef(input);
  if (!ref) return null;

  let tier: string | null = null;
  let tenantMaxConcurrency: number | null = null;

  if (ref.ownerType === "TENANT") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ref.ownerId },
      select: { maxConcurrency: true, packageLevel: true, planId: true },
    });
    tenantMaxConcurrency = tenant?.maxConcurrency ?? null;
    tier = tenant?.packageLevel ?? null;
    if (!tier && tenant?.planId) {
      const plan = await prisma.membershipPlan.findUnique({
        where: { id: tenant.planId },
        select: { tier: true },
      });
      tier = plan?.tier ?? null;
    }
  }

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: ref.ownerType, ownerId: ref.ownerId } },
    select: { planId: true },
  });
  if (!tier && account?.planId) {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: account.planId },
      select: { tier: true },
    });
    tier = plan?.tier ?? null;
  }

  return resolveVideoLimitsFromBilling({
    ownerType: ref.ownerType,
    ownerId: ref.ownerId,
    tier,
    tenantMaxConcurrency,
  });
}

/** @deprecated 请用 resolveVideoRiskLimits */
export async function resolveVideoRiskContext(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
}): Promise<{ accountId: string; tier: string | null } | null> {
  const limits = await resolveVideoRiskLimits(input);
  if (!limits) return null;
  return { accountId: limits.accountId, tier: limits.tier };
}

/**
 * 视频发起综合风控（在 createRequestLog 内、冻结预扣前调用）。
 * 通过则登记提交（计数/突发）并占用并发槽；任一不通过抛 VideoRiskError。
 */
export async function guardVideoGenerate(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
  batchCount?: number;
}): Promise<{ accountId: string | null; riskPopup?: string }> {
  // 批量阈值不依赖 Redis，始终校验
  const batch = Math.max(1, Math.round(input.batchCount ?? 1));
  if (exceedsBatchLimit(batch)) {
    throw new VideoRiskError("BATCH_TOO_LARGE", `单次批量最多 ${VIDEO_BATCH_MAX} 集，当前 ${batch}`);
  }
  if (!isConcurrencyEnabled()) return { accountId: null };

  const limits = await resolveVideoRiskLimits(input);
  if (!limits) return { accountId: null };

  const risk = await assertVideoAllowed({
    accountId: limits.accountId,
    tier: limits.tier,
    batchCount: batch,
    maxQueue: limits.maxQueue,
  });
  await acquireVideoConcurrency(limits.accountId, limits.maxConcurrency);
  await recordVideoSubmission({ accountId: limits.accountId, batchCount: batch });
  return { accountId: limits.accountId, riskPopup: risk.popupMessage };
}

/** 视频任务结束（成功/失败）释放并发与队列计数。 */
export async function releaseVideoGenerate(accountId: string | null | undefined): Promise<void> {
  if (!accountId) return;
  await releaseVideoConcurrency(accountId);
  await releaseVideoQueue(accountId);
}
