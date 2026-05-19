import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * v003 钱包预占用（hold / reservation）。
 *
 * 设计目标：解决"按秒计费先生成、后扣费"场景下的两个风险：
 *   1) 超扣（余额 ¥10 启动了出账 ¥30 的视频任务）
 *   2) 余额低于水位线也能发起请求
 *
 * 流程：reserve → settle / release / expire
 *   - reserve：估算上限点数；硬门禁拦截可用余额不足；写入 HELD 状态
 *   - settle：拿到云厂商真实 durationSec/imageCount 后，扣真实 chargePoints 并 SETTLED
 *   - release：失败/取消，HELD → RELEASED
 *   - expire：超过 expiresAt 仍 HELD，cron 自动转 RELEASED（reason=expired）
 *
 * 钱包"可用余额"= balancePoints − Σ(WalletHold WHERE status=HELD).reservedPoints。
 */

const SAFETY_MARGIN = 1.2;

export type ReserveWalletHoldInput = {
  userId: string;
  toolKey: string;
  action?: string | null;
  /** 预估上限（点）；调用方按"最大可能用量 × 系数"计算后传入。本函数会再乘 SAFETY_MARGIN（×1.2）。 */
  estimatedMaxPoints: number;
  /** 任务幂等键（典型：云厂商 taskId）；同 (userId, taskKey) 视为同一 reserve，重复调用直接返回现有 hold。 */
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

/** 估上限：把传入的 estimatedMaxPoints 加 20% 安全边际后取整。 */
export function applySafetyMargin(estimatedMaxPoints: number): number {
  if (!Number.isFinite(estimatedMaxPoints) || estimatedMaxPoints <= 0) return 0;
  return Math.max(1, Math.ceil(estimatedMaxPoints * SAFETY_MARGIN));
}

async function loadHoldPolicy(): Promise<{ ttlMin: number; watermark: number }> {
  const cfg = await prisma.platformConfig.findUnique({
    where: { id: "default" },
    select: { walletHoldDefaultTtlMin: true, minBalanceLinePoints: true },
  });
  return {
    ttlMin:
      typeof cfg?.walletHoldDefaultTtlMin === "number" && cfg.walletHoldDefaultTtlMin > 0
        ? cfg.walletHoldDefaultTtlMin
        : 30,
    watermark:
      typeof cfg?.minBalanceLinePoints === "number" && cfg.minBalanceLinePoints > 0
        ? cfg.minBalanceLinePoints
        : 0,
  };
}

export async function reserveWalletHold(input: ReserveWalletHoldInput): Promise<ReserveWalletHoldResult> {
  const reserved = applySafetyMargin(input.estimatedMaxPoints);
  if (reserved <= 0) {
    return {
      ok: false,
      reason: "insufficient_balance",
      balancePoints: 0,
      heldPoints: 0,
      requiredPoints: 0,
    };
  }

  const policy = await loadHoldPolicy();
  const ttlMin = input.ttlMinutes && input.ttlMinutes > 0 ? input.ttlMinutes : policy.ttlMin;

  // 机会主义打扫：每次 reserve 前把已过期的 HELD 转 EXPIRED，避免锁住可用余额。
  // 失败不影响主流程（仅记日志）。
  try {
    await releaseExpiredHolds();
  } catch (e) {
    console.warn("[reserveWalletHold] opportunistic expire failed", e);
  }

  return prisma.$transaction(async (tx) => {
    if (input.taskKey) {
      const existed = await tx.walletHold.findUnique({
        where: { userId_taskKey: { userId: input.userId, taskKey: input.taskKey } },
        select: { id: true, status: true, reservedPoints: true, expiresAt: true },
      });
      if (existed && existed.status === "HELD") {
        return {
          ok: true as const,
          holdId: existed.id,
          reservedPoints: existed.reservedPoints,
          expiresAt: existed.expiresAt,
          reused: true,
        };
      }
    }

    await tx.wallet.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId },
      update: {},
    });

    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { userId: input.userId },
      select: { balancePoints: true, frozenPoints: true },
    });
    const heldAgg = await tx.walletHold.aggregate({
      where: { userId: input.userId, status: "HELD" },
      _sum: { reservedPoints: true },
    });
    const heldNow = heldAgg._sum.reservedPoints ?? 0;
    const available = wallet.balancePoints - wallet.frozenPoints - heldNow;

    if (available < reserved) {
      return {
        ok: false as const,
        reason: "insufficient_balance",
        balancePoints: wallet.balancePoints,
        heldPoints: heldNow,
        requiredPoints: reserved,
        ...(policy.watermark > 0 ? { watermarkPoints: policy.watermark } : {}),
      };
    }
    if (policy.watermark > 0 && available - reserved < policy.watermark) {
      return {
        ok: false as const,
        reason: "below_watermark",
        balancePoints: wallet.balancePoints,
        heldPoints: heldNow,
        requiredPoints: reserved,
        watermarkPoints: policy.watermark,
      };
    }

    const expiresAt = new Date(Date.now() + ttlMin * 60_000);
    const created = await tx.walletHold.create({
      data: {
        userId: input.userId,
        toolKey: input.toolKey,
        action: input.action ?? null,
        reservedPoints: reserved,
        status: "HELD",
        taskKey: input.taskKey ?? null,
        ...(input.meta != null ? { meta: input.meta as Prisma.InputJsonValue } : {}),
        expiresAt,
      },
      select: { id: true, reservedPoints: true, expiresAt: true },
    });
    return {
      ok: true as const,
      holdId: created.id,
      reservedPoints: created.reservedPoints,
      expiresAt: created.expiresAt,
      reused: false,
    };
  });
}

export type ReleaseWalletHoldInput = {
  holdId?: string;
  /** 可代替 holdId 用 (userId, taskKey) 释放（幂等：失败回调常拿不到 holdId 只拿 taskKey）。 */
  userId?: string;
  taskKey?: string;
  reason?: string;
};

export type ReleaseWalletHoldResult =
  | { ok: true; holdId: string; alreadyReleased?: boolean }
  | { ok: false; reason: "not_found" | "already_settled" };

export async function releaseWalletHold(input: ReleaseWalletHoldInput): Promise<ReleaseWalletHoldResult> {
  const where: Prisma.WalletHoldWhereInput = input.holdId
    ? { id: input.holdId }
    : input.userId && input.taskKey
      ? { userId: input.userId, taskKey: input.taskKey }
      : ({ id: "__never__" } as Prisma.WalletHoldWhereInput);

  const hold = await prisma.walletHold.findFirst({ where, select: { id: true, status: true } });
  if (!hold) return { ok: false, reason: "not_found" };
  if (hold.status === "SETTLED") return { ok: false, reason: "already_settled" };
  if (hold.status === "RELEASED" || hold.status === "EXPIRED") {
    return { ok: true, holdId: hold.id, alreadyReleased: true };
  }
  await prisma.walletHold.update({
    where: { id: hold.id },
    data: {
      status: "RELEASED",
      releaseReason: input.reason ?? null,
    },
  });
  return { ok: true, holdId: hold.id };
}

/** Cron / on-demand：把 HELD 且 expiresAt < now 的 hold 批量转 EXPIRED。返回过期数量。 */
export async function releaseExpiredHolds(now: Date = new Date()): Promise<number> {
  const result = await prisma.walletHold.updateMany({
    where: { status: "HELD", expiresAt: { lt: now } },
    data: { status: "EXPIRED", releaseReason: "ttl_expired" },
  });
  return result.count;
}
