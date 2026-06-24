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

/** 同项目并发 SSE 合并为单次 in-flight 查询 */
const snapshotInflight = new Map<string, Promise<CanvasTaskSyncSnapshot>>();

/** 同项目并发 SSE / poll 共享快照，避免连接池被 duplicate query 打满 */
const SNAPSHOT_CACHE_MS = (() => {
  const raw = Number(process.env.CANVAS_TASK_SNAPSHOT_CACHE_MS ?? "");
  return Number.isFinite(raw) && raw >= 500 ? raw : 5000;
})();

export const CANVAS_TASK_SSE_POLL_MS = (() => {
  const raw = Number(process.env.CANVAS_TASK_SSE_POLL_MS ?? "");
  return Number.isFinite(raw) && raw >= 5000 ? raw : 12_000;
})();

/** 无进行中任务时的 SSE 轮询间隔（默认 30s，减轻 dev:all 连接池压力） */
export const CANVAS_TASK_SSE_IDLE_POLL_MS = (() => {
  const raw = Number(process.env.CANVAS_TASK_SSE_IDLE_POLL_MS ?? "");
  return Number.isFinite(raw) && raw >= 10_000 ? raw : 30_000;
})();

export const CANVAS_TASK_SSE_HEARTBEAT_MS = 15000;

/** 连续 DB 失败后暂停 SSE 快照查询，避免失败风暴占满连接池 */
export const CANVAS_TASK_SSE_DB_BACKOFF_MS = (() => {
  const raw = Number(process.env.CANVAS_TASK_SSE_DB_BACKOFF_MS ?? "");
  return Number.isFinite(raw) && raw >= 10_000 ? raw : 60_000;
})();

export function resolveCanvasTaskSsePollDelayMs(
  snap: Pick<CanvasTaskSyncSnapshot, "inflightCount">,
): number {
  return snap.inflightCount > 0
    ? CANVAS_TASK_SSE_POLL_MS
    : CANVAS_TASK_SSE_IDLE_POLL_MS;
}

export function isCanvasTaskSseEnabled(): boolean {
  const v = process.env.CANVAS_TASK_SSE?.trim().toLowerCase();
  return v === "1" || v === "true";
}

async function loadCanvasProjectTaskSyncSnapshot(
  projectId: string,
): Promise<CanvasTaskSyncSnapshot> {
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

  return {
    fingerprint,
    inflightCount,
    taskCount,
    latestUpdatedAt: latest?.toISOString() ?? null,
  };
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
    const inflight = snapshotInflight.get(projectId);
    if (inflight) return inflight;
  }

  const promise = loadCanvasProjectTaskSyncSnapshot(projectId)
    .then((snap) => {
      snapshotCache.set(projectId, { snap, fetchedAt: Date.now() });
      return snap;
    })
    .finally(() => {
      snapshotInflight.delete(projectId);
    });

  snapshotInflight.set(projectId, promise);
  return promise;
}

export function invalidateCanvasTaskSyncSnapshotCache(projectId?: string): void {
  if (projectId) snapshotCache.delete(projectId);
  else snapshotCache.clear();
}
