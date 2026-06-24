import { prisma } from "@/lib/prisma";

import type { TrafficScope } from "./scope-key";

/** 入队交通灯：同 scope 内第 N 条 QUEUED 的 dispatch 基准间隔（硬编码，不发 deploy env）。 */
export const QUEUE_SLOT_BASE_MS = 5000;

/** 每条入队附加随机抖动 ∈ [0, JITTER] ms。 */
export const QUEUE_SLOT_JITTER_MS = 3000;

function scopeQueuedWhere(scope: TrafficScope) {
  if (scope.ownerType === "TENANT") {
    return { tenantId: scope.ownerId };
  }
  return { tenantId: null, actorUserId: scope.ownerId };
}

/** 纯函数：queueIndex × base + jitter，便于单测。
 *
 * 队首（scope 内无其它 QUEUED，index=0）**立即可派发**：不加抖动，
 * 让 admit 之后那拍 `fireCanvasDispatchForProject` 当场就能取到本任务
 * （findMany 用 `dispatchAfter <= now`），避免「点了生成、几十秒没反应」。
 * 抖动 / 错峰只用于 index≥1 的积压，防止批量入队时同拍打爆厂商。 */
export function queueDispatchAfterFromIndex(
  index: number,
  nowMs = Date.now(),
): Date {
  const slot = Math.max(0, Math.floor(index));
  if (slot === 0) {
    return new Date(nowMs);
  }
  const jitter =
    QUEUE_SLOT_JITTER_MS > 0
      ? Math.floor(Math.random() * (QUEUE_SLOT_JITTER_MS + 1))
      : 0;
  return new Date(nowMs + slot * QUEUE_SLOT_BASE_MS + jitter);
}

export async function countQueuedCanvasForScope(
  scope: TrafficScope,
): Promise<number> {
  return prisma.canvasGenerationTask.count({
    where: {
      status: "QUEUED",
      ...scopeQueuedWhere(scope),
    },
  });
}

export async function countQueuedStoryForScope(
  scope: TrafficScope,
): Promise<number> {
  return prisma.storyGenerationTask.count({
    where: {
      status: "QUEUED",
      ...scopeQueuedWhere(scope),
    },
  });
}

export async function computeCanvasQueueDispatchAfter(
  scope: TrafficScope,
  nowMs = Date.now(),
): Promise<Date> {
  const index = await countQueuedCanvasForScope(scope);
  return queueDispatchAfterFromIndex(index, nowMs);
}

export async function computeStoryQueueDispatchAfter(
  scope: TrafficScope,
  nowMs = Date.now(),
): Promise<Date> {
  const index = await countQueuedStoryForScope(scope);
  return queueDispatchAfterFromIndex(index, nowMs);
}
