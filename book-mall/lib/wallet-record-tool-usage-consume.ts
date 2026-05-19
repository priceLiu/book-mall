import type { Prisma } from "@prisma/client";
import { ModelAliasSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildToolUsageBillingLineData,
  type ToolUsagePricingSnapshot,
  type ToolUsageCanonicalHint,
  type ToolUsageUserHint,
} from "@/lib/finance/tool-usage-billing-line";

/**
 * v004：事务前一次 SELECT 用户的"对外标识"，注入 cloudRow 的「平台/用户名」+「平台/用户ID」。
 * User 模型当前只有 name 与 email（无 phone）；name → email 顺序兜底，都没有就退回 user id。
 */
async function resolveUserHint(userId: string): Promise<ToolUsageUserHint> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!u) return { userId, userLabel: userId };
  const label = u.name?.trim() || u.email?.trim() || userId;
  return { userId: u.id, userLabel: label };
}

/**
 * v003：把 meta 里能拿到的"内部模型字串"按优先级（modelId / tryOnModel / videoModel / textToImageModel / apiModel）
 * 逐条反查 ModelAlias → ModelCatalog；命中后把 displayName / canonicalKey / vendor 用于固化到 cloudRow。
 *
 * v008：禁止使用 `aliasValue: { in: [...] }` + `findFirst`——多值时数据库返回顺序不确定，可能命中错误目录。
 */
async function resolveCanonicalFromMeta(
  meta: Prisma.InputJsonValue | undefined,
): Promise<ToolUsageCanonicalHint | null> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  const catalogSelect = {
    canonicalKey: true,
    displayName: true,
    vendor: true,
    vendorProductName: true,
    vendorCommodityCode: true,
    vendorCommodityName: true,
    vendorBillableItemCode: true,
    vendorBillableItemName: true,
  } as const;
  const seen = new Set<string>();
  for (const k of ["modelId", "tryOnModel", "videoModel", "textToImageModel", "apiModel"] as const) {
    const v = m[k];
    if (typeof v !== "string" || !v.trim()) continue;
    const trimmed = v.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    const hit = await prisma.modelAlias.findFirst({
      where: {
        active: true,
        source: ModelAliasSource.INTERNAL_SCHEME_A_MODEL,
        aliasValue: trimmed,
        catalog: { active: true },
      },
      select: { catalog: { select: catalogSelect } },
    });
    const c = hit?.catalog;
    if (c) {
      return {
        canonicalKey: c.canonicalKey,
        displayName: c.displayName,
        vendor: c.vendor,
        vendorProductName: c.vendorProductName,
        vendorCommodityCode: c.vendorCommodityCode,
        vendorCommodityName: c.vendorCommodityName,
        vendorBillableItemCode: c.vendorBillableItemCode,
        vendorBillableItemName: c.vendorBillableItemName,
      };
    }
  }
  return null;
}

/**
 * 与 AI 试衣成片上报一致：`meta.taskId` 作为幂等键，避免重复扣款 / 重复流水。
 */
export function toolUsageWalletIdempotencyKey(
  toolKey: string,
  action: string,
  meta: Prisma.InputJsonValue | undefined,
): string | undefined {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const taskId = (meta as Record<string, unknown>).taskId;
  if (typeof taskId !== "string") return undefined;
  const t = taskId.trim();
  if (!t) return undefined;
  return `tool_usage:${toolKey}:${action}:${t}`;
}

export type RecordToolUsageConsumeResult =
  | { ok: true; balanceAfterPoints: number; usageEventId: string }
  | { ok: false; reason: "duplicate" }
  | {
      ok: false;
      reason: "insufficient_balance";
      balancePoints: number;
      /** v002 P2-3：当因低于水位线被拦截时，返回当前生效的水位线点数（便于 UI 提示） */
      watermarkPoints?: number;
      /** 触发原因：纯余额不足 vs 余额减预扣后会破水位线 */
      gate?: "balance" | "watermark";
    };

/**
 * 记工具扣费流水并同步扣减钱包（同一事务）。
 */
export async function recordToolUsageAndConsumeWallet(opts: {
  userId: string;
  toolKey: string;
  action: string;
  costPoints: number;
  meta: Prisma.InputJsonValue | undefined;
  /**
   * v002：调用方（`POST /api/sso/tools/usage` 等）解析 `ToolBillablePrice` 后传入的快照，
   * 写 ToolBillingDetailLine 时一次性固化 internal* 列。未传入则 internal* 列为空（兼容旧路径）。
   */
  pricingSnapshot?: ToolUsagePricingSnapshot;
  /** v003：按秒计费时实际计费秒数（已含 minBilledVideoSec 兜底），写入 ToolUsageEvent.billedVideoSec */
  billedVideoSec?: number | null;
  /** v003：与本次 settle 绑定的 WalletHold.id（若走 reserve→settle 流程） */
  walletHoldId?: string | null;
}): Promise<RecordToolUsageConsumeResult> {
  const key = toolUsageWalletIdempotencyKey(
    opts.toolKey,
    opts.action,
    opts.meta,
  );

  // v003：把 meta 里的"内部模型 id"反查 ModelCatalog（命中则把 canonical 写进 cloudRow）。
  // 事务前查询，单次 SELECT；命中 → 落地，没命中 → 走 toolKeyToLabel 兜底（与旧行为一致）。
  const canonical = await resolveCanonicalFromMeta(opts.meta);

  // v004：把 User.name/email/phone 反查为"平台/用户名"，注入 cloudRow。
  // 同样事务前 SELECT，避免每行 cloudRow 都查一次（finance-web 拉一页 50 条就是 50 次 N+1）。
  const userHint = await resolveUserHint(opts.userId);

  try {
    return await prisma.$transaction(async (tx) => {
      if (key) {
        const dup = await tx.walletEntry.findUnique({
          where: { idempotencyKey: key },
          select: { id: true },
        });
        if (dup) return { ok: false, reason: "duplicate" };
      }

      await tx.wallet.upsert({
        where: { userId: opts.userId },
        create: { userId: opts.userId },
        update: {},
      });

      /**
       * v002 P2-3 + v003 P5：水位线开跑前硬门禁。
       *
       * available = balancePoints
       *           − frozenPoints
       *           − Σ(WalletHold WHERE userId AND status=HELD AND id != settlingHoldId)
       *
       * 关键修复：必须把"该用户其它仍在 HELD 状态"的预占用一起扣掉，否则可能出现：
       *   - balance=100，HoldA reserved=60（HELD），现在用 HoldB 来 settle 50
       *   - 旧逻辑：available=100，50 < 100 + watermark 不报错 → 实际可用余额 -10
       *   - 新逻辑：available=100 − 60 = 40，50 > 40 → 立即报 watermark 错
       * 当前 settle 自己绑定的 hold（settlingHoldId）不计入扣减，因为它的"占用额度"即将被本次 settle 释放并替换成真实扣费。
       */
      const cfg = await tx.platformConfig.findUnique({
        where: { id: "default" },
        select: { minBalanceLinePoints: true },
      });
      const watermark =
        typeof cfg?.minBalanceLinePoints === "number" && cfg.minBalanceLinePoints > 0
          ? cfg.minBalanceLinePoints
          : 0;

      const walletNow = await tx.wallet.findUniqueOrThrow({
        where: { userId: opts.userId },
        select: { balancePoints: true, frozenPoints: true },
      });
      const settlingHoldId = opts.walletHoldId ?? null;
      const otherHeldAgg = await tx.walletHold.aggregate({
        where: {
          userId: opts.userId,
          status: "HELD",
          ...(settlingHoldId ? { id: { not: settlingHoldId } } : {}),
        },
        _sum: { reservedPoints: true },
      });
      const otherHeld = otherHeldAgg._sum.reservedPoints ?? 0;
      const available = walletNow.balancePoints - walletNow.frozenPoints - otherHeld;

      if (available < opts.costPoints) {
        return {
          ok: false,
          reason: "insufficient_balance",
          balancePoints: walletNow.balancePoints,
          watermarkPoints: watermark,
          gate: "balance",
        };
      }
      if (watermark > 0 && available - opts.costPoints < watermark) {
        return {
          ok: false,
          reason: "insufficient_balance",
          balancePoints: walletNow.balancePoints,
          watermarkPoints: watermark,
          gate: "watermark",
        };
      }

      const dec = await tx.wallet.updateMany({
        where: {
          userId: opts.userId,
          balancePoints: { gte: opts.costPoints },
        },
        data: { balancePoints: { decrement: opts.costPoints } },
      });

      if (dec.count !== 1) {
        const w = await tx.wallet.findUniqueOrThrow({
          where: { userId: opts.userId },
          select: { balancePoints: true },
        });
        return {
          ok: false,
          reason: "insufficient_balance",
          balancePoints: w.balancePoints,
          watermarkPoints: watermark,
          gate: "balance",
        };
      }

      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: opts.userId },
      });

      const ev = await tx.toolUsageEvent.create({
        data: {
          userId: opts.userId,
          toolKey: opts.toolKey,
          action: opts.action,
          costPoints: opts.costPoints,
          ...(opts.meta !== undefined ? { meta: opts.meta } : {}),
          ...(typeof opts.billedVideoSec === "number" && opts.billedVideoSec > 0
            ? { billedVideoSec: opts.billedVideoSec }
            : {}),
          ...(opts.walletHoldId ? { walletHoldId: opts.walletHoldId } : {}),
        },
      });

      /**
       * v003：若本次扣费绑定到一个 WalletHold（reserve→settle 流程），同事务把 hold 转 SETTLED；
       * 状态校验：仅 HELD 可 settle，避免重复结算或对已 RELEASED/EXPIRED 的 hold 误算。
       */
      if (opts.walletHoldId) {
        const settle = await tx.walletHold.updateMany({
          where: { id: opts.walletHoldId, status: "HELD" },
          data: {
            status: "SETTLED",
            settledChargePoints: opts.costPoints,
            settledUsageEventId: ev.id,
          },
        });
        if (settle.count !== 1) {
          throw new Error(`WalletHold ${opts.walletHoldId} 不可结算（已 SETTLED/RELEASED/EXPIRED 或不存在）`);
        }
      }

      await tx.walletEntry.create({
        data: {
          walletId: wallet.id,
          type: "CONSUME",
          amountPoints: -opts.costPoints,
          balanceAfterPoints: wallet.balancePoints,
          idempotencyKey: key ?? undefined,
          description: `工具消耗 · ${opts.toolKey} · ${opts.action} · ¥${(opts.costPoints / 100).toFixed(2)}`,
        },
      });

      if (opts.costPoints > 0) {
        await tx.toolBillingDetailLine.create({
          data: buildToolUsageBillingLineData({
            userId: opts.userId,
            toolKey: opts.toolKey,
            action: opts.action,
            costPoints: opts.costPoints,
            meta: opts.meta,
            usageEventId: ev.id,
            createdAt: ev.createdAt,
            snap: opts.pricingSnapshot,
            canonical,
            userHint,
          }),
        });
      }

      return {
        ok: true,
        balanceAfterPoints: wallet.balancePoints,
        usageEventId: ev.id,
      };
    },
    // v003 fix：事务内有 8+ 次顺序 DB I/O（platformConfig + wallet + otherHeldAgg
    // + wallet.updateMany + wallet.findFirst + toolUsageEvent + walletHold.updateMany?
    // + walletEntry + toolBillingDetailLine）。Prisma 默认 interactive transaction 5s
    // 在 dev 冷启动 / RTT 抖动时会打穿（P2028）。把 timeout 上调到 30s（同口径于
    // apply-pending-migrations 的迁移事务），maxWait 给 10s 留排队余地。
    // 真实生产 settle 一般 < 200ms，30s 仅作上限保护。
    { maxWait: 10_000, timeout: 30_000 });
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: unknown }).code)
        : "";
    if (code === "P2002" && key) {
      return { ok: false, reason: "duplicate" };
    }
    throw e;
  }
}
