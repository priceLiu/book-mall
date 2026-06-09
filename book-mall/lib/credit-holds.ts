import type { Prisma } from "@prisma/client";

import {
  getPoolBalances,
  InsufficientCreditsError,
  releaseReserved,
  reserveCredits,
  settleReserved,
  type AccountRef,
} from "@/lib/billing/credit-account-service";
import { prisma } from "@/lib/prisma";

/** 与 wallet-holds 同口径：预估上限 × 1.2 安全边际。 */
const SAFETY_MARGIN = 1.2;

export type ReserveCreditHoldInput = {
  userId: string;
  toolKey: string;
  action?: string | null;
  estimatedMaxCredits: number;
  taskKey?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

export type ReserveCreditHoldResult =
  | {
      ok: true;
      holdId: string;
      reservedCredits: number;
      reused: boolean;
    }
  | {
      ok: false;
      reason: "insufficient_balance";
      balanceCredits: number;
      reservedCredits: number;
      requiredCredits: number;
    };

function accountRef(userId: string): AccountRef {
  return { ownerType: "USER", ownerId: userId };
}

export function applyCreditSafetyMargin(estimatedMaxCredits: number): number {
  if (!Number.isFinite(estimatedMaxCredits) || estimatedMaxCredits <= 0) return 0;
  return Math.max(1, Math.ceil(estimatedMaxCredits * SAFETY_MARGIN));
}

function reserveKey(userId: string, taskKey: string): string {
  return `hold:reserve:${userId}:${taskKey}`;
}

/** 积分预占用：冻结 credits（GENERAL 池），taskKey 幂等。 */
export async function reserveCreditHold(
  input: ReserveCreditHoldInput,
): Promise<ReserveCreditHoldResult> {
  const reserved = applyCreditSafetyMargin(input.estimatedMaxCredits);
  if (reserved <= 0) {
    return {
      ok: false,
      reason: "insufficient_balance",
      balanceCredits: 0,
      reservedCredits: 0,
      requiredCredits: 0,
    };
  }

  const ref = accountRef(input.userId);
  const pools = await getPoolBalances(ref);
  const available = pools.general.balance - pools.general.reserved;
  if (available < reserved) {
    return {
      ok: false,
      reason: "insufficient_balance",
      balanceCredits: pools.general.balance,
      reservedCredits: pools.general.reserved,
      requiredCredits: reserved,
    };
  }

  const taskKey = input.taskKey?.trim();
  if (taskKey) {
    const existed = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: reserveKey(input.userId, taskKey) },
      select: { credits: true },
    });
    if (existed) {
      return {
        ok: true,
        holdId: taskKey,
        reservedCredits: Math.abs(existed.credits),
        reused: true,
      };
    }
  }

  const holdId = taskKey ?? `hold_${Date.now()}`;
  await reserveCredits({
    ref,
    credits: reserved,
    pool: "GENERAL",
    idempotencyKey: reserveKey(input.userId, holdId),
    description: `工具预占 · ${input.toolKey}${input.action ? ` · ${input.action}` : ""}`,
  });

  if (taskKey && taskKey !== holdId) {
    // 兼容：若 taskKey 与 holdId 不同，仍按 holdId 冻结
  }

  return { ok: true, holdId, reservedCredits: reserved, reused: false };
}

/** 释放未使用的冻结积分（失败/取消）。 */
export async function releaseCreditHold(input: {
  userId: string;
  holdId: string;
}): Promise<void> {
  const ledger = await prisma.creditLedger.findUnique({
    where: { idempotencyKey: reserveKey(input.userId, input.holdId) },
    select: { credits: true, pool: true },
  });
  if (!ledger) return;
  const frozen = Math.abs(ledger.credits);
  if (frozen <= 0) return;
  await releaseReserved({
    ref: accountRef(input.userId),
    credits: frozen,
    pool: ledger.pool,
    idempotencyKey: `hold:release:${input.userId}:${input.holdId}`,
    description: "工具预占释放",
  });
}

/**
 * 结算预占：实扣 actualCredits；若预占 > 实扣则退还差额。
 * 无预占时直接返回 false，由调用方走 consumeCredits。
 */
export async function settleCreditHold(input: {
  userId: string;
  holdId: string;
  actualCredits: number;
  idempotencyKey?: string;
}): Promise<boolean> {
  const ledger = await prisma.creditLedger.findUnique({
    where: { idempotencyKey: reserveKey(input.userId, input.holdId) },
    select: { credits: true, pool: true },
  });
  if (!ledger) return false;

  const frozen = Math.abs(ledger.credits);
  const actual = Math.max(0, Math.round(input.actualCredits));
  if (frozen <= 0) return false;

  const ref = accountRef(input.userId);
  const pool = ledger.pool;

  await settleReserved({
    ref,
    credits: Math.min(actual, frozen),
    pool,
    idempotencyKey: input.idempotencyKey ?? `hold:settle:${input.userId}:${input.holdId}`,
    description: "工具预占结算",
  });

  if (frozen > actual) {
    await releaseReserved({
      ref,
      credits: frozen - actual,
      pool,
      idempotencyKey: `hold:release:excess:${input.userId}:${input.holdId}`,
      description: "工具预占差额返还",
    });
  }
  return true;
}

export { InsufficientCreditsError };
