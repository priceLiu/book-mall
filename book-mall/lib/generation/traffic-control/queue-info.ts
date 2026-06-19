import { prisma } from "@/lib/prisma";

export async function countQueuePosition(input: {
  scopeKey: string;
  queuedAt: Date;
  table: "canvas" | "story";
}): Promise<number> {
  const where = {
    status: "QUEUED" as const,
    tenantId: input.scopeKey.startsWith("tenant:")
      ? input.scopeKey.slice("tenant:".length)
      : undefined,
    ...(input.scopeKey.startsWith("user:")
      ? {
          actorUserId: input.scopeKey.slice("user:".length),
          tenantId: null,
        }
      : {}),
    queuedAt: { lte: input.queuedAt },
  };

  if (input.table === "canvas") {
    return prisma.canvasGenerationTask.count({ where });
  }
  return prisma.storyGenerationTask.count({ where });
}

export function estimateWaitSec(queuePosition: number): number {
  return Math.max(0, (queuePosition - 1) * 2);
}

export async function attachQueueInfo<T extends { status: string; queuedAt?: Date | null }>(
  task: T,
  scopeKey: string,
  table: "canvas" | "story",
): Promise<T & { queuePosition?: number; estimatedWaitSec?: number }> {
  if (task.status !== "QUEUED" || !task.queuedAt) return task;
  const queuePosition = await countQueuePosition({
    scopeKey,
    queuedAt: task.queuedAt,
    table,
  });
  return {
    ...task,
    queuePosition,
    estimatedWaitSec: estimateWaitSec(queuePosition),
  };
}
