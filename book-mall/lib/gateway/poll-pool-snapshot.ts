/**
 * Gateway 控制台 · 轮询池快照（Gateway RUNNING + Canvas/Story SUBMITTED|PENDING）。
 */
import type { Prisma } from "@prisma/client";

import { getGenerationPollBatch } from "@/lib/generation/poll-config";
import {
  isSlowGenerationAge,
} from "@/lib/generation/slow-generation";
import {
  isVideoBackgroundWaitAge,
  VIDEO_BACKGROUND_UI_MS,
} from "@/lib/gateway/video-task-wait-policy";
import {
  readGenerationSlowWarnConfig,
  resolveGenerationSlowWarnMs,
} from "@/lib/generation/slow-warn-config";
import {
  buildDashboardLogWhere,
  type DashboardQueryParams,
  type DashboardScopeParam,
} from "@/lib/gateway/log-dashboard-query";
import { resolveTeamMemberUserIds } from "@/lib/gateway/log-dashboard-actor";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const GATEWAY_POLL_PROVIDER_KINDS = [
  "KIE",
  "BAILIAN",
  "DASHSCOPE",
  "HUNYUAN",
  "VOLCENGINE",
] as const;

const POOL_LIMIT = 80;

export type PollPoolGatewayRow = {
  id: string;
  status: string;
  providerKind: string | null;
  requestKind: string;
  model: string | null;
  canonicalModelKey: string | null;
  clientSource: string;
  externalTaskId: string | null;
  submittedAt: string;
  lastPolledAt: string | null;
  pollCount: number;
  ageSec: number;
  slowWarn: boolean;
  backgroundWait: boolean;
  gatewayLogId: string;
};

export type PollPoolAppTaskRow = {
  id: string;
  app: "canvas" | "story";
  status: string;
  kind: string;
  projectId: string;
  projectName: string;
  nodeId: string | null;
  gatewayLogId: string | null;
  vendorTaskId: string | null;
  submittedAt: string;
  lastPolledAt: string | null;
  pollCount: number;
  ageSec: number;
  slowWarn: boolean;
  backgroundWait: boolean;
};

export type PollPoolSnapshot = {
  serverTime: string;
  config: {
    slowWarnMs: number;
    slowWarnSec: number;
    slowWarnSource?: "platform" | "env";
    backgroundWaitMs: number;
    backgroundWaitSec: number;
    gatewayPollLimit: number;
    canvasPollBatch: number;
  };
  gateway: {
    total: number;
    slowCount: number;
    backgroundCount: number;
    queue: PollPoolGatewayRow[];
  };
  canvas: {
    totalSubmitted: number;
    totalPending: number;
    slowCount: number;
    backgroundCount: number;
    queue: PollPoolAppTaskRow[];
  };
  story: {
    totalSubmitted: number;
    totalPending: number;
    slowCount: number;
    backgroundCount: number;
    queue: PollPoolAppTaskRow[];
  };
};

function ageSecFrom(
  submittedAt: Date | null | undefined,
  createdAt: Date,
  nowMs: number,
): number {
  const ts = (submittedAt ?? createdAt).getTime();
  return Math.max(0, Math.round((nowMs - ts) / 1000));
}

async function resolveProjectOwnerUserIds(input: {
  scope: DashboardScopeParam;
  tenantId?: string;
  bookUserId: string | null;
  isPlatformAdmin: boolean;
}): Promise<string[] | null> {
  if (input.scope === "all" && input.isPlatformAdmin) return null;
  if (input.scope === "team" && input.tenantId) {
    return resolveTeamMemberUserIds(input.tenantId);
  }
  if (input.bookUserId) return [input.bookUserId];
  return [];
}

async function buildCanvasPollWhere(
  ownerUserIds: string[] | null,
): Promise<Prisma.CanvasGenerationTaskWhereInput> {
  const base: Prisma.CanvasGenerationTaskWhereInput = {
    status: { in: ["SUBMITTED", "PENDING"] },
  };
  if (ownerUserIds === null) return base;
  if (ownerUserIds.length === 0) return { id: "__none__" };
  return {
    ...base,
    project: { userId: { in: ownerUserIds } },
  };
}

async function buildStoryPollWhere(
  ownerUserIds: string[] | null,
): Promise<Prisma.StoryGenerationTaskWhereInput> {
  const base: Prisma.StoryGenerationTaskWhereInput = {
    status: { in: ["SUBMITTED", "PENDING"] },
  };
  if (ownerUserIds === null) return base;
  if (ownerUserIds.length === 0) return { id: "__none__" };
  return {
    ...base,
    project: { userId: { in: ownerUserIds } },
  };
}

function mapGatewayRow(
  row: {
    id: string;
    status: string;
    providerKind: string | null;
    requestKind: string;
    model: string | null;
    canonicalModelKey: string | null;
    clientSource: string;
    externalTaskId: string | null;
    submittedAt: Date;
    lastPolledAt: Date | null;
    pollCount: number;
  },
  nowMs: number,
  slowWarnMs: number,
): PollPoolGatewayRow {
  return {
    id: row.id,
    gatewayLogId: row.id,
    status: row.status,
    providerKind: row.providerKind,
    requestKind: row.requestKind,
    model: row.model,
    canonicalModelKey: row.canonicalModelKey,
    clientSource: row.clientSource,
    externalTaskId: row.externalTaskId,
    submittedAt: row.submittedAt.toISOString(),
    lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
    pollCount: row.pollCount,
    ageSec: ageSecFrom(row.submittedAt, row.submittedAt, nowMs),
    slowWarn: isSlowGenerationAge(
      row.submittedAt,
      row.submittedAt,
      nowMs,
      slowWarnMs,
    ),
    backgroundWait: isVideoBackgroundWaitAge(
      row.submittedAt,
      row.submittedAt,
      nowMs,
    ),
  };
}

export async function fetchPollPoolSnapshot(input: {
  gatewaySessionUser: { id: string; bookUserId: string | null; email: string };
  query: DashboardQueryParams;
  limit?: number;
  slowWarnMs?: number;
}): Promise<PollPoolSnapshot> {
  const nowMs = Date.now();
  const limit = input.limit ?? POOL_LIMIT;
  const slowWarnMs =
    input.slowWarnMs ?? (await resolveGenerationSlowWarnMs());
  const slowCutoff = new Date(nowMs - slowWarnMs);

  const bookUserId = input.gatewaySessionUser.bookUserId;
  const bookUser = bookUserId
    ? await prisma.user.findUnique({
        where: { id: bookUserId },
        select: { role: true },
      })
    : null;
  const isPlatformAdmin = canViewFinanceCost(bookUser?.role);

  const scopeWhere = await buildDashboardLogWhere({
    gatewaySessionUser: input.gatewaySessionUser,
    query: input.query,
  });

  const gatewayRunningWhere: Prisma.GatewayRequestLogWhereInput = {
    AND: [
      scopeWhere,
      {
        status: "RUNNING",
        externalTaskId: { not: null },
        providerKind: { in: [...GATEWAY_POLL_PROVIDER_KINDS] },
      },
    ],
  };

  const ownerUserIds = await resolveProjectOwnerUserIds({
    scope: input.query.scope,
    tenantId: input.query.tenantId,
    bookUserId,
    isPlatformAdmin,
  });

  const [gatewayTotal, gatewaySlowCount, slowGatewayRows, normalGatewayRows, canvasWhere, storyWhere] =
    await Promise.all([
      prisma.gatewayRequestLog.count({ where: gatewayRunningWhere }),
      prisma.gatewayRequestLog.count({
        where: {
          AND: [gatewayRunningWhere, { submittedAt: { lte: slowCutoff } }],
        },
      }),
      prisma.gatewayRequestLog.findMany({
        where: {
          AND: [gatewayRunningWhere, { submittedAt: { lte: slowCutoff } }],
        },
        orderBy: { submittedAt: "asc" },
        take: limit,
        select: {
          id: true,
          status: true,
          providerKind: true,
          requestKind: true,
          model: true,
          canonicalModelKey: true,
          clientSource: true,
          externalTaskId: true,
          submittedAt: true,
          lastPolledAt: true,
          pollCount: true,
        },
      }),
      prisma.gatewayRequestLog.findMany({
        where: {
          AND: [
            gatewayRunningWhere,
            { submittedAt: { gt: slowCutoff } },
          ],
        },
        orderBy: [{ pollCount: "asc" }, { submittedAt: "desc" }],
        take: limit,
        select: {
          id: true,
          status: true,
          providerKind: true,
          requestKind: true,
          model: true,
          canonicalModelKey: true,
          clientSource: true,
          externalTaskId: true,
          submittedAt: true,
          lastPolledAt: true,
          pollCount: true,
        },
      }),
      buildCanvasPollWhere(ownerUserIds),
      buildStoryPollWhere(ownerUserIds),
    ]);

  const slowIds = new Set(slowGatewayRows.map((r) => r.id));
  const gatewayQueue = [
    ...slowGatewayRows.map((r) => mapGatewayRow(r, nowMs, slowWarnMs)),
    ...normalGatewayRows
      .filter((r) => !slowIds.has(r.id))
      .map((r) => mapGatewayRow(r, nowMs, slowWarnMs)),
  ].slice(0, limit);

  const [canvasTasks, storyTasks, canvasStatusCounts, storyStatusCounts] =
    await Promise.all([
    prisma.canvasGenerationTask.findMany({
      where: canvasWhere,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        kind: true,
        nodeId: true,
        projectId: true,
        kieTaskId: true,
        submittedAt: true,
        createdAt: true,
        lastPolledAt: true,
        pollCount: true,
        inputPayload: true,
        project: { select: { name: true } },
      },
    }),
    prisma.storyGenerationTask.findMany({
      where: storyWhere,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        kind: true,
        projectId: true,
        kieTaskId: true,
        gatewayLogId: true,
        submittedAt: true,
        createdAt: true,
        lastPolledAt: true,
        pollCount: true,
        inputPayload: true,
        project: { select: { name: true } },
      },
    }),
    prisma.canvasGenerationTask.groupBy({
      by: ["status"],
      where: canvasWhere,
      _count: { _all: true },
    }),
    prisma.storyGenerationTask.groupBy({
      by: ["status"],
      where: storyWhere,
      _count: { _all: true },
    }),
  ]);

  const countByStatus = (
    rows: { status: string; _count: { _all: number } }[],
    status: string,
  ) => rows.find((r) => r.status === status)?._count._all ?? 0;

  const canvasSubmittedCount = countByStatus(canvasStatusCounts, "SUBMITTED");
  const canvasPendingCount = countByStatus(canvasStatusCounts, "PENDING");
  const storySubmittedCount = countByStatus(storyStatusCounts, "SUBMITTED");
  const storyPendingCount = countByStatus(storyStatusCounts, "PENDING");

  const mapAppTask = (
    app: "canvas" | "story",
    task: {
      id: string;
      status: string;
      kind: string;
      projectId: string;
      nodeId?: string;
      kieTaskId: string | null;
      gatewayLogId?: string | null;
      submittedAt: Date | null;
      createdAt: Date;
      lastPolledAt: Date | null;
      pollCount: number;
      inputPayload: unknown;
      project: { name: string };
    },
  ): PollPoolAppTaskRow => {
    const payload =
      task.inputPayload && typeof task.inputPayload === "object"
        ? (task.inputPayload as Record<string, unknown>)
        : null;
    const gatewayLogId =
      task.gatewayLogId?.trim() ||
      (typeof payload?.gatewayLogId === "string"
        ? payload.gatewayLogId.trim()
        : null);
    return {
      id: task.id,
      app,
      status: task.status,
      kind: task.kind,
      projectId: task.projectId,
      projectName: task.project.name,
      nodeId: task.nodeId ?? null,
      gatewayLogId,
      vendorTaskId: task.kieTaskId,
      submittedAt: (task.submittedAt ?? task.createdAt).toISOString(),
      lastPolledAt: task.lastPolledAt?.toISOString() ?? null,
      pollCount: task.pollCount,
      ageSec: ageSecFrom(task.submittedAt, task.createdAt, nowMs),
      slowWarn: isSlowGenerationAge(
        task.submittedAt,
        task.createdAt,
        nowMs,
        slowWarnMs,
      ),
      backgroundWait: isVideoBackgroundWaitAge(
        task.submittedAt,
        task.createdAt,
        nowMs,
      ),
    };
  };

  const canvasQueue = canvasTasks.map((t) => mapAppTask("canvas", t));
  const storyQueue = storyTasks.map((t) => mapAppTask("story", t));

  const canvasSlowCount = canvasQueue.filter((t) => t.slowWarn).length;
  const storySlowCount = storyQueue.filter((t) => t.slowWarn).length;
  const gatewayBackgroundCount = gatewayQueue.filter((t) => t.backgroundWait).length;
  const canvasBackgroundCount = canvasQueue.filter((t) => t.backgroundWait).length;
  const storyBackgroundCount = storyQueue.filter((t) => t.backgroundWait).length;

  const warnCfg = await readGenerationSlowWarnConfig();

  return {
    serverTime: new Date(nowMs).toISOString(),
    config: {
      slowWarnMs: warnCfg.slowWarnMs,
      slowWarnSec: warnCfg.slowWarnSec,
      slowWarnSource: warnCfg.source,
      backgroundWaitMs: VIDEO_BACKGROUND_UI_MS,
      backgroundWaitSec: VIDEO_BACKGROUND_UI_MS / 1000,
      gatewayPollLimit: 20,
      canvasPollBatch: getGenerationPollBatch(),
    },
    gateway: {
      total: gatewayTotal,
      slowCount: gatewaySlowCount,
      backgroundCount: gatewayBackgroundCount,
      queue: gatewayQueue,
    },
    canvas: {
      totalSubmitted: canvasSubmittedCount,
      totalPending: canvasPendingCount,
      slowCount: canvasSlowCount,
      backgroundCount: canvasBackgroundCount,
      queue: canvasQueue,
    },
    story: {
      totalSubmitted: storySubmittedCount,
      totalPending: storyPendingCount,
      slowCount: storySlowCount,
      backgroundCount: storyBackgroundCount,
      queue: storyQueue,
    },
  };
}
