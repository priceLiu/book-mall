/**
 * 视频专项风控（财务 2.0 · Phase 3）
 *
 * 当前仅保留不依赖外部存储的阈值（如单次批量上限）。
 * 并发/队列/日 cap 等需 Redis 的能力已移除；后续若要做控流见 DB 方案讨论。
 */
import { prisma } from "@/lib/prisma";
import { resolveBillingRef } from "./credit-pre-check";

export const VIDEO_MAX_CONCURRENCY = 2;
export const VIDEO_MAX_QUEUE = 10;
export const VIDEO_BATCH_MAX = 5;

/** 套餐档日 cap 参考值（管理端异常扫描用；Gateway 入口暂不强制） */
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

export function getVideoPersonalMaxConcurrency(): number {
  const raw = Number(process.env.VIDEO_MAX_CONCURRENCY ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : VIDEO_MAX_CONCURRENCY;
}

export function getVideoPersonalMaxQueue(): number {
  const raw = Number(process.env.VIDEO_MAX_QUEUE ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : VIDEO_MAX_QUEUE;
}

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

export type VideoRiskReason = "BATCH_TOO_LARGE";

export class VideoRiskError extends Error {
  constructor(
    public readonly reason: VideoRiskReason,
    message: string,
  ) {
    super(message);
    this.name = "VideoRiskError";
  }
}

export function exceedsBatchLimit(count: number): boolean {
  return Math.round(count) > VIDEO_BATCH_MAX;
}

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

/** 视频发起前校验（当前仅批量集数）。 */
export async function guardVideoGenerate(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
  batchCount?: number;
}): Promise<{ accountId: string | null; riskPopup?: string }> {
  const batch = Math.max(1, Math.round(input.batchCount ?? 1));
  if (exceedsBatchLimit(batch)) {
    throw new VideoRiskError(
      "BATCH_TOO_LARGE",
      `单次批量最多 ${VIDEO_BATCH_MAX} 集，当前 ${batch}`,
    );
  }
  const limits = await resolveVideoRiskLimits(input);
  return { accountId: limits?.accountId ?? null };
}

/** 任务结束占位（无 Redis 计数可释放）。 */
export async function releaseVideoGenerate(_accountId: string | null | undefined): Promise<void> {}
