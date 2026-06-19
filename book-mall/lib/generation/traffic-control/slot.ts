import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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

/** 事务内：token bucket + spacing + 信号灯占槽 */
export async function acquireTrafficSlotInTx(
  tx: Prisma.TransactionClient,
  scope: TrafficScope,
): Promise<AcquireSlotResult> {
  const maxConcurrency = await resolveMaxConcurrencyForScope(scope);
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

  if (spacingBlocked(state.lastDispatchAt, now.getTime())) {
    return {
      ok: false,
      reason: "spacing",
      retryAfter: nextDispatchAfterFromSpacing(state.lastDispatchAt),
    };
  }

  const tokens = refillTokenBucket(state, now.getTime());
  if (tokens < 1) {
    return { ok: false, reason: "tokens" };
  }

  if (state.runningVideoCount >= state.maxConcurrency) {
    return { ok: false, reason: "concurrency" };
  }

  await tx.generationTrafficState.update({
    where: { scopeKey: scope.scopeKey },
    data: {
      runningVideoCount: state.runningVideoCount + 1,
      dispatchTokens: tokens - 1,
      lastTokenRefillAt: now,
      lastDispatchAt: now,
    },
  });

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
  return prisma.$transaction((tx) => acquireTrafficSlotInTx(tx, scope));
}
