/**
 * 画布项目 · 任务变更指纹（SSE / 侧栏 invalidate 用，轻量读）。
 */
import { prisma } from "@/lib/prisma";

export type CanvasTaskSyncSnapshot = {
  fingerprint: string;
  inflightCount: number;
  taskCount: number;
  latestUpdatedAt: string | null;
};

type SnapshotRow = {
  latest: Date | null;
  total: bigint;
  inflight: bigint;
};

const snapshotCache = new Map<
  string,
  { snap: CanvasTaskSyncSnapshot; fetchedAt: number }
>();

/** 同项目并发 SSE / poll 共享快照，避免连接池被 duplicate query 打满 */
const SNAPSHOT_CACHE_MS = (() => {
  const raw = Number(process.env.CANVAS_TASK_SNAPSHOT_CACHE_MS ?? "");
  return Number.isFinite(raw) && raw >= 500 ? raw : 3000;
})();

export const CANVAS_TASK_SSE_POLL_MS = (() => {
  const raw = Number(process.env.CANVAS_TASK_SSE_POLL_MS ?? "");
  return Number.isFinite(raw) && raw >= 3000 ? raw : 8000;
})();

/** 无进行中任务时的 SSE 轮询间隔（默认 20s，减轻 dev:all 连接池压力） */
export const CANVAS_TASK_SSE_IDLE_POLL_MS = (() => {
  const raw = Number(process.env.CANVAS_TASK_SSE_IDLE_POLL_MS ?? "");
  return Number.isFinite(raw) && raw >= 5000 ? raw : 20_000;
})();

export const CANVAS_TASK_SSE_HEARTBEAT_MS = 15000;

export function resolveCanvasTaskSsePollDelayMs(
  snap: Pick<CanvasTaskSyncSnapshot, "inflightCount">,
): number {
  return snap.inflightCount > 0
    ? CANVAS_TASK_SSE_POLL_MS
    : CANVAS_TASK_SSE_IDLE_POLL_MS;
}

export async function getCanvasProjectTaskSyncSnapshot(
  projectId: string,
  opts?: { bypassCache?: boolean },
): Promise<CanvasTaskSyncSnapshot> {
  const now = Date.now();
  if (!opts?.bypassCache) {
    const hit = snapshotCache.get(projectId);
    if (hit && now - hit.fetchedAt < SNAPSHOT_CACHE_MS) {
      return hit.snap;
    }
  }

  const rows = await prisma.$queryRaw<SnapshotRow[]>`
    SELECT
      MAX("updatedAt") AS latest,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE status IN (
          'QUEUED',
          'DISPATCHING',
          'PENDING',
          'SUBMITTED'
        )
      )::bigint AS inflight
    FROM "CanvasGenerationTask"
    WHERE "projectId" = ${projectId}
      AND "deletedAt" IS NULL
  `;

  const row = rows[0];
  const latest = row?.latest ?? null;
  const taskCount = Number(row?.total ?? 0);
  const inflightCount = Number(row?.inflight ?? 0);
  const fingerprint = `${latest?.getTime() ?? 0}:${taskCount}:${inflightCount}`;

  const snap: CanvasTaskSyncSnapshot = {
    fingerprint,
    inflightCount,
    taskCount,
    latestUpdatedAt: latest?.toISOString() ?? null,
  };

  snapshotCache.set(projectId, { snap, fetchedAt: now });
  return snap;
}

export function invalidateCanvasTaskSyncSnapshotCache(projectId?: string): void {
  if (projectId) snapshotCache.delete(projectId);
  else snapshotCache.clear();
}
