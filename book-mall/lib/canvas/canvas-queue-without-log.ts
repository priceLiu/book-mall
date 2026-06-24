/**
 * 画布视频任务 · 交通控流排队（QUEUED / DISPATCHING）且尚未创建 Gateway 日志。
 */
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const CANVAS_QUEUE_WITHOUT_LOG_STATUSES = ["QUEUED", "DISPATCHING"] as const;

export type CanvasQueueWithoutLogStatus =
  (typeof CANVAS_QUEUE_WITHOUT_LOG_STATUSES)[number];

/** inputPayload.kind 为画布视频引擎（DB kind 常为 IMAGE，以 payload 为准） */
export function canvasVideoPayloadWhere(): Prisma.CanvasGenerationTaskWhereInput {
  return {
    OR: [
      { inputPayload: { path: ["kind"], equals: "video-engine" } },
      { inputPayload: { path: ["kind"], equals: "ai-video-engine" } },
    ],
  };
}

export function buildCanvasQueueWithoutLogWhere(
  ownerUserIds: string[] | null,
): Prisma.CanvasGenerationTaskWhereInput {
  const base: Prisma.CanvasGenerationTaskWhereInput = {
    status: { in: [...CANVAS_QUEUE_WITHOUT_LOG_STATUSES] },
    ...canvasVideoPayloadWhere(),
  };
  if (ownerUserIds === null) return base;
  if (ownerUserIds.length === 0) return { id: "__none__" };
  return {
    ...base,
    project: { userId: { in: ownerUserIds } },
  };
}

function staleQueuedWhere(staleMinutes: number): Prisma.CanvasGenerationTaskWhereInput {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);
  return {
    OR: [
      { queuedAt: { lte: cutoff } },
      { queuedAt: null, createdAt: { lte: cutoff } },
    ],
  };
}

export type CanvasQueueWithoutLogStats = {
  /** 尚无 Gateway log 的排队总数 */
  total: number;
  queued: number;
  dispatching: number;
  /** 排队超过 staleMinutes 仍未 dispatch */
  staleCount: number;
  staleMinutes: number;
  fetchedAt: string;
};

const queueStatsCache = new Map<
  string,
  { stats: CanvasQueueWithoutLogStats; fetchedAt: number }
>();
const QUEUE_STATS_CACHE_MS = 5000;

function queueStatsCacheKey(
  ownerUserIds: string[] | null,
  staleMinutes: number,
): string {
  const owners =
    ownerUserIds === null ? "*" : ownerUserIds.length ? ownerUserIds.join(",") : "__none__";
  return `${owners}:${staleMinutes}`;
}

export async function fetchCanvasQueueWithoutLogStats(input: {
  ownerUserIds: string[] | null;
  staleMinutes?: number;
}): Promise<CanvasQueueWithoutLogStats> {
  const staleMinutes = input.staleMinutes ?? 2;
  const cacheKey = queueStatsCacheKey(input.ownerUserIds, staleMinutes);
  const now = Date.now();
  const hit = queueStatsCache.get(cacheKey);
  if (hit && now - hit.fetchedAt < QUEUE_STATS_CACHE_MS) {
    return hit.stats;
  }

  const where = buildCanvasQueueWithoutLogWhere(input.ownerUserIds);
  const staleWhere = staleQueuedWhere(staleMinutes);

  const [grouped, staleCount] = await Promise.all([
    prisma.canvasGenerationTask.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.canvasGenerationTask.count({
      where: { AND: [where, staleWhere] },
    }),
  ]);

  const byStatus = Object.fromEntries(
    grouped.map((r) => [r.status, r._count._all]),
  ) as Record<string, number>;

  const queued = byStatus.QUEUED ?? 0;
  const dispatching = byStatus.DISPATCHING ?? 0;

  const stats: CanvasQueueWithoutLogStats = {
    total: queued + dispatching,
    queued,
    dispatching,
    staleCount,
    staleMinutes,
    fetchedAt: new Date().toISOString(),
  };
  queueStatsCache.set(cacheKey, { stats, fetchedAt: now });
  return stats;
}

export type CanvasQueuedTaskRow = {
  id: string;
  status: string;
  projectId: string;
  projectName: string;
  nodeId: string;
  model: string | null;
  queuedAt: string | null;
  createdAt: string;
  dispatchAfter: string | null;
  waitMinutes: number;
  payloadKind: string | null;
  actorUserId: string | null;
};

export async function listCanvasQueuedWithoutLogTasks(input: {
  ownerUserIds?: string[] | null;
  staleMinutes?: number;
  limit?: number;
}): Promise<CanvasQueuedTaskRow[]> {
  const staleMinutes = input.staleMinutes ?? 0;
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
  const where = buildCanvasQueueWithoutLogWhere(input.ownerUserIds ?? null);
  const andParts: Prisma.CanvasGenerationTaskWhereInput[] = [where];
  if (staleMinutes > 0) {
    andParts.push(staleQueuedWhere(staleMinutes));
  }

  const rows = await prisma.canvasGenerationTask.findMany({
    where: { AND: andParts },
    orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      projectId: true,
      nodeId: true,
      model: true,
      queuedAt: true,
      createdAt: true,
      dispatchAfter: true,
      actorUserId: true,
      inputPayload: true,
      project: { select: { name: true } },
    },
  });

  const now = Date.now();
  return rows.map((t) => {
    const anchor = t.queuedAt ?? t.createdAt;
    const payload =
      t.inputPayload && typeof t.inputPayload === "object"
        ? (t.inputPayload as Record<string, unknown>)
        : null;
    return {
      id: t.id,
      status: t.status,
      projectId: t.projectId,
      projectName: t.project.name,
      nodeId: t.nodeId,
      model: t.model,
      queuedAt: t.queuedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      dispatchAfter: t.dispatchAfter?.toISOString() ?? null,
      waitMinutes: Math.floor(Math.max(0, now - anchor.getTime()) / 60_000),
      payloadKind:
        typeof payload?.kind === "string" ? payload.kind : null,
      actorUserId: t.actorUserId,
    };
  });
}
