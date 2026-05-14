import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
  | { ok: false; reason: "insufficient_balance"; balancePoints: number };

/**
 * 记工具扣费流水并同步扣减钱包（同一事务）。
 */
export async function recordToolUsageAndConsumeWallet(opts: {
  userId: string;
  toolKey: string;
  action: string;
  costPoints: number;
  meta: Prisma.InputJsonValue | undefined;
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
