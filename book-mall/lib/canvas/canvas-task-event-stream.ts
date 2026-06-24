/**
 * 画布项目 · 任务变更指纹（SSE / 侧栏 invalidate 用，轻量读）。
 */
import { prisma } from "@/lib/prisma";

const INFLIGHT_STATUSES = [
  "QUEUED",
  "DISPATCHING",
  "PENDING",
  "SUBMITTED",
] as const;

export type CanvasTaskSyncSnapshot = {
  fingerprint: string;
  inflightCount: number;
  taskCount: number;
  latestUpdatedAt: string | null;
};

export async function getCanvasProjectTaskSyncSnapshot(
  projectId: string,
): Promise<CanvasTaskSyncSnapshot> {
  const [agg, inflightCount] = await Promise.all([
    prisma.canvasGenerationTask.aggregate({
      where: { projectId, deletedAt: null },
      _max: { updatedAt: true },
      _count: { _all: true },
    }),
    prisma.canvasGenerationTask.count({
      where: {
        projectId,
        deletedAt: null,
        status: { in: [...INFLIGHT_STATUSES] },
      },
    }),
  ]);

  const latest = agg._max.updatedAt;
  const taskCount = agg._count._all;
  const fingerprint = `${latest?.getTime() ?? 0}:${taskCount}:${inflightCount}`;

  return {
    fingerprint,
    inflightCount,
    taskCount,
    latestUpdatedAt: latest?.toISOString() ?? null,
  };
}

export const CANVAS_TASK_SSE_POLL_MS = (() => {
  const raw = Number(process.env.CANVAS_TASK_SSE_POLL_MS ?? "");
  return Number.isFinite(raw) && raw >= 1500 ? raw : 2500;
})();

export const CANVAS_TASK_SSE_HEARTBEAT_MS = 15000;
