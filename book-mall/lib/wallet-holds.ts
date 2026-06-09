/**
 * @deprecated 财务 2.0：预占已迁至 CreditAccount。保留导出名以兼容旧 import。
 */
import type { Prisma } from "@prisma/client";

import {
  applyCreditSafetyMargin,
  releaseCreditHold,
  reserveCreditHold,
} from "@/lib/credit-holds";

export type ReserveWalletHoldInput = {
  userId: string;
  toolKey: string;
  action?: string | null;
  estimatedMaxPoints: number;
  taskKey?: string | null;
  meta?: Prisma.InputJsonValue | null;
  ttlMinutes?: number;
};

export type ReserveWalletHoldResult =
  | {
      ok: true;
      holdId: string;
      reservedPoints: number;
      expiresAt: Date;
      reused: boolean;
    }
  | {
      ok: false;
      reason: "insufficient_balance" | "below_watermark";
      balancePoints: number;
      heldPoints: number;
      requiredPoints: number;
      watermarkPoints?: number;
    };

export function applySafetyMargin(estimatedMaxPoints: number): number {
  return applyCreditSafetyMargin(estimatedMaxPoints);
}

export async function reserveWalletHold(
  input: ReserveWalletHoldInput,
): Promise<ReserveWalletHoldResult> {
  const r = await reserveCreditHold({
    userId: input.userId,
    toolKey: input.toolKey,
    action: input.action,
    estimatedMaxCredits: input.estimatedMaxPoints,
    taskKey: input.taskKey,
    meta: input.meta,
  });
  if (!r.ok) {
    return {
      ok: false,
      reason: "insufficient_balance",
      balancePoints: r.balanceCredits,
      heldPoints: r.reservedCredits,
      requiredPoints: r.requiredCredits,
    };
  }
  return {
    ok: true,
    holdId: r.holdId,
    reservedPoints: r.reservedCredits,
    expiresAt: new Date(Date.now() + (input.ttlMinutes ?? 30) * 60_000),
    reused: r.reused,
  };
}

export type ReleaseWalletHoldInput = {
  holdId?: string;
  userId?: string;
  taskKey?: string;
  reason?: string;
};

export type ReleaseWalletHoldResult =
  | { ok: true; holdId: string; alreadyReleased?: boolean }
  | { ok: false; reason: "not_found" | "already_settled" };

export async function releaseWalletHold(
  input: ReleaseWalletHoldInput,
): Promise<ReleaseWalletHoldResult> {
  const holdId = input.holdId ?? input.taskKey;
  if (!input.userId || !holdId) return { ok: false, reason: "not_found" };
  await releaseCreditHold({ userId: input.userId, holdId });
  return { ok: true, holdId };
}

/** Cron 兼容：积分预占无 TTL 表，保留空实现。 */
export async function releaseExpiredHolds(_now?: Date): Promise<number> {
  return 0;
}
