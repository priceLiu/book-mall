/**
 * 画布视频任务 · 交通控流排队（QUEUED / DISPATCHING）且尚未创建 Gateway 日志。
 */
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { readTrafficStartedAtIso } from "@/lib/generation/traffic-control/traffic-timing";

/** 交通控流 · 尚未提交厂商（必无 Gateway log） */
export const CANVAS_QUEUE_WITHOUT_LOG_STATUSES = [
  "QUEUED",
  "DISPATCHING",
  "PENDING",
] as const;

export type CanvasQueueWithoutLogStatus =
  (typeof CANVAS_QUEUE_WITHOUT_LOG_STATUSES)[number];

export function readCanvasTaskGatewayLogId(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  const raw = payload?.gatewayLogId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readPayloadRecord(inputPayload: unknown): Record<string, unknown> | null {
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return null;
  }
  return inputPayload as Record<string, unknown>;
}

/** 画布视频 · 用户已点击生成、但 Gateway 日志尚未出现（含 SUBMITTED 但未写 gatewayLogId 的窗口期） */
export function isCanvasVideoPreGatewayLogTask(input: {
  status: string;
  inputPayload: unknown;
}): boolean {
  const payload = readPayloadRecord(input.inputPayload);
  if (!payload) return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  if (kind !== "video-engine" && kind !== "ai-video-engine") return false;
  if (
    input.status === "QUEUED" ||
    input.status === "DISPATCHING" ||
    input.status === "PENDING"
  ) {
    return true;
  }
  if (input.status === "SUBMITTED") {
    return !readCanvasTaskGatewayLogId(payload);
  }
  return false;
}

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
    ...canvasVideoPayloadWhere(),
    OR: [
      { status: { in: [...CANVAS_QUEUE_WITHOUT_LOG_STATUSES] } },
      { status: "SUBMITTED" },
    ],
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

  const submittedCandidates = await prisma.canvasGenerationTask.findMany({
    where: {
      AND: [
        where,
        { status: "SUBMITTED" },
      ],
    },
    select: { inputPayload: true },
  });
  const submittedPreLog = submittedCandidates.filter((t) =>
    isCanvasVideoPreGatewayLogTask({
      status: "SUBMITTED",
      inputPayload: t.inputPayload,
    }),
  ).length;

  const byStatus = Object.fromEntries(
    grouped
      .filter((r) => r.status !== "SUBMITTED")
      .map((r) => [r.status, r._count._all]),
  ) as Record<string, number>;

  const queued = byStatus.QUEUED ?? 0;
  const dispatching =
    (byStatus.DISPATCHING ?? 0) +
    (byStatus.PENDING ?? 0) +
    submittedPreLog;

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
  /** 用户点击生成锚点（自愈重排不重置） */
  trafficStartedAt: string;
  dispatchAfter: string | null;
  waitMinutes: number;
  payloadKind: string | null;
  actorUserId: string | null;
  inputPayload: Record<string, unknown> | null;
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
  return rows
    .filter((t) =>
      isCanvasVideoPreGatewayLogTask({
        status: t.status,
        inputPayload: t.inputPayload,
      }),
    )
    .map((t) => {
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
      trafficStartedAt: readTrafficStartedAtIso(
        payload,
        t.queuedAt ?? t.createdAt,
      ),
      payloadKind:
        typeof payload?.kind === "string" ? payload.kind : null,
      actorUserId: t.actorUserId,
      inputPayload: payload,
    };
  });
}
