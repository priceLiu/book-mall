import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CANVAS_DB_TX_OPTIONS } from "@/lib/db-tx-retry";
import { getTrafficTokensPerSec, computeTokenBurst } from "./constants";
import {
  refillTokenBucket,
  spacingBlocked,
  nextDispatchAfterFromSpacing,
} from "./token-bucket";
import {
  resolveMaxConcurrencyForScope,
  type TrafficScope,
} from "./scope-key";

export type AcquireSlotResult =
  | { ok: true }
  | { ok: false; reason: "concurrency" | "tokens" | "spacing"; retryAfter?: Date };

export type AcquireTrafficSlotOpts = {
  /**
   * 生图批次不走视频车间距 / token 滴灌。
   * 仍受 maxConcurrency 限制；提交到 Gateway 后由调用方立刻释放槽，厂商侧才能并行。
   */
  ignorePipelinePacing?: boolean;
};

/** 事务内：token bucket + spacing + 信号灯占槽 */
export async function acquireTrafficSlotInTx(
  tx: Prisma.TransactionClient,
  scope: TrafficScope,
  /** 事务外预解析，避免 tx 内再开 prisma 查询拖过 5s 默认超时 */
  maxConcurrencyOverride?: number,
  opts?: AcquireTrafficSlotOpts,
): Promise<AcquireSlotResult> {
  const maxConcurrency =
    maxConcurrencyOverride ?? (await resolveMaxConcurrencyForScope(scope));
  const tokensPerSec = getTrafficTokensPerSec();
  const now = new Date();

  let state = await tx.generationTrafficState.findUnique({
    where: { scopeKey: scope.scopeKey },
  });

  if (!state) {
    state = await tx.generationTrafficState.create({
      data: {
        scopeKey: scope.scopeKey,
        ownerType: scope.ownerType,
        ownerId: scope.ownerId,
        maxConcurrency,
        tokensPerSec,
        dispatchTokens: computeTokenBurst(maxConcurrency),
        lastTokenRefillAt: now,
      },
    });
  } else if (state.maxConcurrency !== maxConcurrency) {
    state = await tx.generationTrafficState.update({
      where: { scopeKey: scope.scopeKey },
      data: { maxConcurrency, tokensPerSec },
    });
  }

  const ignorePacing = opts?.ignorePipelinePacing === true;
  if (!ignorePacing && spacingBlocked(state.lastDispatchAt, now.getTime())) {
    return {
      ok: false,
      reason: "spacing",
      retryAfter: nextDispatchAfterFromSpacing(state.lastDispatchAt),
    };
  }

  const tokens = refillTokenBucket(state, now.getTime());
  if (!ignorePacing && tokens < 1) {
    return { ok: false, reason: "tokens" };
  }

  if (state.runningVideoCount >= state.maxConcurrency) {
    return { ok: false, reason: "concurrency" };
  }

  // 原子占槽：WHERE 守卫 runningVideoCount < maxConcurrency。即使另一笔下发事务并发占槽，
  // 行级写锁会在本 UPDATE 取锁后按"最新已提交值"重新判定守卫，从而硬性不越过并发上限
  // （此前 read-then-write 在 ReadCommitted 下会出现 7 > 6 的越额并发）。
  const claimed = await tx.generationTrafficState.updateMany({
    where: {
      scopeKey: scope.scopeKey,
      runningVideoCount: { lt: state.maxConcurrency },
    },
    data: {
      runningVideoCount: { increment: 1 },
      dispatchTokens: ignorePacing ? tokens : tokens - 1,
      lastTokenRefillAt: now,
      lastDispatchAt: now,
    },
  });
  if (claimed.count === 0) {
    return { ok: false, reason: "concurrency" };
  }

  return { ok: true };
}

/** 任务终态 / finalize 后释放视频槽（幂等，不低于 0） */
export async function releaseTrafficSlot(scopeKey: string | null | undefined): Promise<void> {
  const key = scopeKey?.trim();
  if (!key) return;
  await prisma.generationTrafficState
    .updateMany({
      where: { scopeKey: key, runningVideoCount: { gt: 0 } },
      data: { runningVideoCount: { decrement: 1 } },
    })
    .catch(() => undefined);
}

/** 从 Gateway log 字段解析 scope 并释放 */
export async function releaseTrafficSlotFromGatewayLog(log: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  userId: string;
  requestKind?: string | null;
}): Promise<void> {
  if (log.requestKind !== "VIDEO") return;
  const { resolveTrafficScopeFromIds } = await import("./scope-key");
  const scope = resolveTrafficScopeFromIds({
    tenantId: log.tenantId,
    actorUserId: log.actorBookUserId,
    userId: log.userId,
  });
  await releaseTrafficSlot(scope.scopeKey);
}

export async function acquireTrafficSlot(scope: TrafficScope): Promise<AcquireSlotResult> {
  const maxConcurrency = await resolveMaxConcurrencyForScope(scope);
  return prisma.$transaction(
    (tx) => acquireTrafficSlotInTx(tx, scope, maxConcurrency),
    CANVAS_DB_TX_OPTIONS,
  );
}
