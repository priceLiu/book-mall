import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildToolUsageBillingLineData,
  type ToolUsagePricingSnapshot,
} from "@/lib/finance/tool-usage-billing-line";

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
}): Promise<RecordToolUsageConsumeResult> {
  const key = toolUsageWalletIdempotencyKey(
    opts.toolKey,
    opts.action,
    opts.meta,
  );

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
       * v002 P2-3：水位线开跑前门禁。
       * 取当前钱包可用余额（balance - frozen）与平台 `minBalanceLinePoints` 比较：
       * 若 `available - cost < minBalanceLine`，**整笔拒绝**，不修改钱包、不写 ToolUsageEvent /
       * WalletEntry / ToolBillingDetailLine；同时把当前水位线返回给调用方便于前端弹出充值。
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
      const available = walletNow.balancePoints - walletNow.frozenPoints;

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
        },
      });

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
          }),
        });
      }

      return {
        ok: true,
        balanceAfterPoints: wallet.balancePoints,
        usageEventId: ev.id,
      };
    });
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
