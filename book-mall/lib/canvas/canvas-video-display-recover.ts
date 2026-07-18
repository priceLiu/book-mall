/**
 * 画布视频 · 任务已成功但节点 runtime 未写回 / Gateway 已成功但 canvas 任务仍 SUBMITTED。
 */
import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import {
  isCanvasBailianR2vVideoTaskPayload,
  isCanvasKieVideoTaskPayload,
  isCanvasVolcengineVideoTaskPayload,
} from "@/lib/canvas/canvas-constants";
import {
  applyCanvasBailianR2vPollResult,
  applyCanvasVolcengineVideoResult,
} from "@/lib/canvas/canvas-task-service";
import { recoverCanvasKieImageFromGateway } from "@/lib/canvas/canvas-kie-image-recover";
import {
  CANVAS_MEDIA_NODE_TYPES,
  CANVAS_VIDEO_MEDIA_NODE_TYPES,
  canvasNodeShowsPersistedMedia,
  patchCanvasJsonNodeMedia,
  patchCanvasProjectNodeMediaFromTask,
  buildMediaRuntimePatchFromTask,
} from "@/lib/canvas/canvas-media-patch";
import {
  extractVolcengineVideoUrlFromGatewaySummary,
  recoverCanvasVolcengineTimedOutTask,
} from "@/lib/canvas/canvas-volcengine-recover";
import { extractBailianR2vVideoUrlFromGatewaySummary } from "@/lib/canvas/canvas-video-bailian-r2v";
import { recoverVolcengineGatewayLogFromVendor } from "@/lib/gateway/volcengine-stall-recover";
import { isRecoverableVolcengineStallFailCode } from "@/lib/gateway/video-background-generation";
import { backfillCanvasTaskGatewayLink } from "@/lib/generation/traffic-control/canvas-orphan-gateway-log";
import { prisma } from "@/lib/prisma";

export type CanvasVideoRecoverAction =
  | "patched_runtime"
  | "applied_from_gateway"
  | "recovered_vendor"
  | "noop"
  | "failed";

export type CanvasVideoRecoverResult = {
  ok: boolean;
  action: CanvasVideoRecoverAction;
  reason?: string;
  taskId: string;
  projectId?: string;
  nodeId?: string;
  ossUrl?: string;
};

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> | null {
  if (!task.inputPayload || typeof task.inputPayload !== "object") return null;
  return task.inputPayload as Record<string, unknown>;
}

function isRecoverableCanvasVideoTask(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): boolean {
  const payload = taskInputPayload(task);
  return (
    isCanvasVolcengineVideoTaskPayload(payload) ||
    isCanvasBailianR2vVideoTaskPayload(payload) ||
    isCanvasKieVideoTaskPayload(payload)
  );
}

function isKieVideoCanvasTask(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): boolean {
  return isCanvasKieVideoTaskPayload(taskInputPayload(task));
}

function isBailianR2vVideoCanvasTask(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): boolean {
  return isCanvasBailianR2vVideoTaskPayload(taskInputPayload(task));
}

/** @deprecated 使用 canvasNodeShowsPersistedMedia */
export function canvasNodeRuntimeShowsVideo(
  canvas: unknown,
  nodeId: string,
  taskId?: string,
): boolean {
  return canvasNodeShowsPersistedMedia(canvas, nodeId, taskId);
}

type CanvasNodeRuntimeLike = {
  status?: string;
  taskId?: string;
  ossUrl?: string;
  ephemeralUrl?: string;
};

async function loadGatewayLog(gatewayLogId: string) {
  return prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: {
      id: true,
      status: true,
      resultSummary: true,
      failCode: true,
      failMessage: true,
      providerKind: true,
    },
  });
}

/** 单条 canvas 视频任务 → 写回项目 canvas JSON runtime */
export async function recoverCanvasVideoTaskDisplay(
  taskId: string,
): Promise<CanvasVideoRecoverResult> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: { select: { id: true, canvas: true } } },
  });
  if (!task) {
    return { ok: false, action: "failed", reason: "task_not_found", taskId };
  }
  if (!isRecoverableCanvasVideoTask(task)) {
    return {
      ok: false,
      action: "failed",
      reason: "not_recoverable_video_task",
      taskId,
      projectId: task.projectId,
      nodeId: task.nodeId,
    };
  }

  const isBailian = isBailianR2vVideoCanvasTask(task);
  const isKie = isKieVideoCanvasTask(task);

  const base = {
    taskId: task.id,
    projectId: task.projectId,
    nodeId: task.nodeId,
  };

  if (
    task.status === "SUCCEEDED" &&
    (task.ossUrl?.trim() || task.ephemeralUrl?.trim())
  ) {
    if (
      canvasNodeShowsPersistedMedia(task.project.canvas, task.nodeId, task.id)
    ) {
      return { ok: true, action: "noop", ...base, ossUrl: task.ossUrl ?? task.ephemeralUrl ?? undefined };
    }
    await patchCanvasProjectNodeMediaFromTask(task);
    return {
      ok: true,
      action: "patched_runtime",
      ...base,
      ossUrl: task.ossUrl ?? task.ephemeralUrl ?? undefined,
    };
  }

  const payload = taskInputPayload(task);
  let gatewayLogId =
    typeof payload?.gatewayLogId === "string"
      ? payload.gatewayLogId.trim()
      : "";
  if (!gatewayLogId) {
    const linked = await backfillCanvasTaskGatewayLink({
      taskId: task.id,
      kieTaskId: task.kieTaskId,
      payload: payload ?? {},
    });
    if (linked) gatewayLogId = linked.gatewayLogId;
  }
  if (gatewayLogId) {
    const log = await loadGatewayLog(gatewayLogId);
    if (log?.status === "SUCCEEDED") {
      if (isKie) {
        const kieOutcome = await recoverCanvasKieImageFromGateway(task.id);
        if (kieOutcome === "succeeded") {
          const updated = await prisma.canvasGenerationTask.findUnique({
            where: { id: task.id },
            select: { status: true, ossUrl: true, ephemeralUrl: true },
          });
          if (
            updated?.status === "SUCCEEDED" &&
            (updated.ossUrl || updated.ephemeralUrl)
          ) {
            return {
              ok: true,
              action: "applied_from_gateway",
              ...base,
              ossUrl: updated.ossUrl ?? updated.ephemeralUrl ?? undefined,
            };
          }
        }
        if (kieOutcome === "failed") {
          return { ok: false, action: "failed", reason: "kie_gateway_failed", ...base };
        }
      }
      if (task.status === "FAILED") {
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: {
            status: "SUBMITTED",
            failCode: null,
            failMessage: null,
            completedAt: null,
            lastPolledAt: new Date(),
          },
        });
      }
      const videoUrl = isBailian
        ? extractBailianR2vVideoUrlFromGatewaySummary(log.resultSummary)
        : extractVolcengineVideoUrlFromGatewaySummary(log.resultSummary);
      if (videoUrl) {
        if (isBailian) {
          await applyCanvasBailianR2vPollResult(task.id, {
            ok: true,
            output: { task_status: "SUCCEEDED", video_url: videoUrl },
            raw: log.resultSummary,
          });
        } else {
          await applyCanvasVolcengineVideoResult(task.id, videoUrl);
        }
        const updated = await prisma.canvasGenerationTask.findUnique({
          where: { id: task.id },
          select: { status: true, ossUrl: true, ephemeralUrl: true },
        });
        if (
          updated?.status === "SUCCEEDED" &&
          (updated.ossUrl || updated.ephemeralUrl)
        ) {
          return {
            ok: true,
            action: "applied_from_gateway",
            ...base,
            ossUrl: updated.ossUrl ?? updated.ephemeralUrl ?? undefined,
          };
        }
      }
    }
    if (
      log?.status === "FAILED" &&
      isRecoverableVolcengineStallFailCode(log.failCode)
    ) {
      const gw = await recoverVolcengineGatewayLogFromVendor(gatewayLogId);
      if (gw.ok && gw.action === "succeeded") {
        return recoverCanvasVideoTaskDisplay(task.id);
      }
    }
  }

  if (
    task.status === "FAILED" &&
    task.failCode &&
    [
      "timeout",
      "timeout_vendor_running",
      "timeout_poll_error",
      "timeout_gateway_sync",
      "timeout_no_gateway",
      "OSS_UPLOAD_FAILED",
      "VOLCENGINE_GATEWAY_POLL_STALL",
      "GATEWAY_TASK_FAILED",
      "GATEWAY_LEGACY_TASK",
    ].includes(task.failCode)
  ) {
    if (task.failCode === "GATEWAY_LEGACY_TASK") {
      const linked = await backfillCanvasTaskGatewayLink({
        taskId: task.id,
        kieTaskId: task.kieTaskId,
        payload: payload ?? {},
      });
      const gwId = linked?.gatewayLogId ?? gatewayLogId;
      if (gwId) {
        const log = await loadGatewayLog(gwId);
        if (log?.status === "RUNNING" || log?.status === "PENDING") {
          await prisma.canvasGenerationTask.update({
            where: { id: task.id },
            data: {
              status: "SUBMITTED",
              failCode: null,
              failMessage: null,
              completedAt: null,
              lastPolledAt: new Date(),
              ...(linked
                ? {
                    kieTaskId: linked.kieTaskId || task.kieTaskId,
                    inputPayload: linked.payload as Prisma.InputJsonValue,
                  }
                : {}),
            },
          });
          return {
            ok: true,
            action: "noop",
            reason: "gateway_legacy_task_reopened",
            ...base,
          };
        }
        if (log?.status === "SUCCEEDED") {
          if (task.status === "FAILED") {
            await prisma.canvasGenerationTask.update({
              where: { id: task.id },
              data: {
                status: "SUBMITTED",
                failCode: null,
                failMessage: null,
                completedAt: null,
                lastPolledAt: new Date(),
              },
            });
          }
          const videoUrl = isBailian
            ? extractBailianR2vVideoUrlFromGatewaySummary(log.resultSummary)
            : extractVolcengineVideoUrlFromGatewaySummary(log.resultSummary);
          if (videoUrl) {
            if (isBailian) {
              await applyCanvasBailianR2vPollResult(task.id, {
                ok: true,
                output: { task_status: "SUCCEEDED", video_url: videoUrl },
                raw: log.resultSummary,
              });
            } else {
              await applyCanvasVolcengineVideoResult(task.id, videoUrl);
            }
            const updated = await prisma.canvasGenerationTask.findUnique({
              where: { id: task.id },
              select: { status: true, ossUrl: true, ephemeralUrl: true },
            });
            if (
              updated?.status === "SUCCEEDED" &&
              (updated.ossUrl || updated.ephemeralUrl)
            ) {
              return {
                ok: true,
                action: "applied_from_gateway",
                ...base,
                ossUrl: updated.ossUrl ?? updated.ephemeralUrl ?? undefined,
              };
            }
          }
        }
      }
      return {
        ok: false,
        action: "failed",
        reason: "gateway_legacy_task_unlinked",
        ...base,
      };
    }
    const r = await recoverCanvasVolcengineTimedOutTask(task.id);
    return {
      ok: r.ok,
      action: r.ok ? "recovered_vendor" : "failed",
      reason: r.reason,
      ...base,
      ossUrl: r.ossUrl,
    };
  }

  if (task.status === "SUBMITTED") {
    return {
      ok: false,
      action: "failed",
      reason: "submitted_without_gateway_video_url",
      ...base,
    };
  }

  return {
    ok: false,
    action: "failed",
    reason: `status=${task.status} failCode=${task.failCode ?? ""}`,
    ...base,
  };
}

export type CanvasVideoRecoverCandidate = {
  taskId: string;
  projectId: string;
  projectName: string;
  nodeId: string;
  taskStatus: string;
  failCode: string | null;
  gatewayStatus: string | null;
  gatewayDurationSec: number | null;
  pollDelayMs: number | null;
  runtimeStatus: string | null;
  hasMedia: boolean;
};

const RECOVER_TASK_SELECT = {
  id: true,
  projectId: true,
  nodeId: true,
  status: true,
  failCode: true,
  ossUrl: true,
  ephemeralUrl: true,
  inputPayload: true,
  project: { select: { name: true, canvas: true } },
} as const;

function gatewayLogMeta(
  gl:
    | {
        status: string;
        durationMs: number | null;
        resultSummary: unknown;
      }
    | undefined,
): {
  gatewayStatus: string | null;
  gatewayDurationSec: number | null;
  pollDelayMs: number | null;
} {
  if (!gl) {
    return {
      gatewayStatus: null,
      gatewayDurationSec: null,
      pollDelayMs: null,
    };
  }
  const tb = (gl.resultSummary as Record<string, unknown> | null)?._gateway as
    | { timingBreakdown?: { pollDelayMs?: number } }
    | undefined;
  return {
    gatewayStatus: gl.status,
    gatewayDurationSec: gl.durationMs
      ? Math.round(gl.durationMs / 1000)
      : null,
    pollDelayMs: tb?.timingBreakdown?.pollDelayMs ?? null,
  };
}

function buildRecoverCandidate(
  t: {
    id: string;
    projectId: string;
    nodeId: string;
    status: string;
    failCode: string | null;
    ossUrl: string | null;
    ephemeralUrl: string | null;
    inputPayload: unknown;
    project: { name: string; canvas: unknown };
  },
  gatewayStatus: string | null,
  gatewayDurationSec: number | null,
  pollDelayMs: number | null,
): CanvasVideoRecoverCandidate | null {
  const canvas = t.project.canvas;
  const node = (
    canvas as {
      nodes?: Array<{ id: string; data?: { runtime?: CanvasNodeRuntimeLike } }>;
    } | null
  )?.nodes?.find((n) => n.id === t.nodeId);
  const rt = node?.data?.runtime;
  const media = Boolean(t.ossUrl?.trim() || t.ephemeralUrl?.trim());
  const runtimeOk = canvasNodeShowsPersistedMedia(canvas, t.nodeId, t.id);

  const needsRecovery =
    (t.status === "SUBMITTED" && gatewayStatus === "SUCCEEDED") ||
    (t.status === "FAILED" &&
      t.failCode != null &&
      (t.failCode.startsWith("timeout") ||
        t.failCode === "VOLCENGINE_GATEWAY_POLL_STALL" ||
        t.failCode === "GATEWAY_TASK_FAILED")) ||
    (t.status === "SUCCEEDED" && media && !runtimeOk) ||
    (gatewayStatus === "SUCCEEDED" && !runtimeOk && !media);

  if (!needsRecovery) return null;

  return {
    taskId: t.id,
    projectId: t.projectId,
    projectName: t.project.name,
    nodeId: t.nodeId,
    taskStatus: t.status,
    failCode: t.failCode,
    gatewayStatus,
    gatewayDurationSec,
    pollDelayMs,
    runtimeStatus: rt?.status ?? null,
    hasMedia: media,
  };
}

/** 扫描需恢复的画布视频任务（SUCCEEDED 未写 runtime / SUBMITTED+Gateway 已成功 / timeout FAILED） */
export async function findCanvasVideoTasksNeedingRecovery(opts?: {
  projectId?: string;
  since?: Date;
  limit?: number;
}): Promise<CanvasVideoRecoverCandidate[]> {
  const since =
    opts?.since ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const limit = opts?.limit ?? 500;
  const projectFilter = opts?.projectId ? { projectId: opts.projectId } : {};
  const perQuery = Math.min(limit, 120);

  const [submittedTasks, failedTasks, succeededTasks] = await Promise.all([
    prisma.canvasGenerationTask.findMany({
      where: {
        status: "SUBMITTED",
        createdAt: { gte: since },
        ...projectFilter,
      },
      orderBy: [{ submittedAt: "asc" }, { updatedAt: "asc" }],
      take: perQuery,
      select: RECOVER_TASK_SELECT,
    }),
    prisma.canvasGenerationTask.findMany({
      where: {
        status: "FAILED",
        createdAt: { gte: since },
        ...projectFilter,
        OR: [
          { failCode: { startsWith: "timeout" } },
          { failCode: "VOLCENGINE_GATEWAY_POLL_STALL" },
          { failCode: "GATEWAY_TASK_FAILED" },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(perQuery, 60),
      select: RECOVER_TASK_SELECT,
    }),
    prisma.canvasGenerationTask.findMany({
      where: {
        status: "SUCCEEDED",
        createdAt: { gte: since },
        ...projectFilter,
        OR: [{ ossUrl: { not: null } }, { ephemeralUrl: { not: null } }],
      },
      orderBy: { completedAt: "desc" },
      take: Math.min(perQuery, 60),
      select: RECOVER_TASK_SELECT,
    }),
  ]);

  const byId = new Map<
    string,
    (typeof submittedTasks)[number]
  >();
  for (const t of [...submittedTasks, ...failedTasks, ...succeededTasks]) {
    byId.set(t.id, t);
  }
  const tasks = [...byId.values()].slice(0, limit);

  const gwIds = [
    ...new Set(
      tasks
        .map((t) => {
          const payload = taskInputPayload(t);
          return typeof payload?.gatewayLogId === "string"
            ? payload.gatewayLogId.trim()
            : "";
        })
        .filter(Boolean),
    ),
  ];
  const gatewayLogs =
    gwIds.length > 0
      ? await prisma.gatewayRequestLog.findMany({
          where: { id: { in: gwIds } },
          select: { id: true, status: true, durationMs: true, resultSummary: true },
        })
      : [];
  const gatewayById = new Map(gatewayLogs.map((gl) => [gl.id, gl]));

  const out: CanvasVideoRecoverCandidate[] = [];

  for (const t of tasks) {
    if (!isRecoverableCanvasVideoTask(t)) continue;

    const payload = taskInputPayload(t);
    const gwId =
      typeof payload?.gatewayLogId === "string"
        ? payload.gatewayLogId.trim()
        : "";
    const { gatewayStatus, gatewayDurationSec, pollDelayMs } = gatewayLogMeta(
      gwId ? gatewayById.get(gwId) : undefined,
    );
    const candidate = buildRecoverCandidate(
      t,
      gatewayStatus,
      gatewayDurationSec,
      pollDelayMs,
    );
    if (candidate) out.push(candidate);
  }

  return out;
}

/** 按节点取最新成功任务并写回 runtime（同一节点多次生成时只展示最新成片） */
export async function recoverCanvasVideoProjectDisplay(
  projectId: string,
): Promise<CanvasVideoRecoverResult[]> {
  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      projectId,
      status: "SUCCEEDED",
      OR: [{ ossUrl: { not: null } }, { ephemeralUrl: { not: null } }],
    },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      nodeId: true,
      completedAt: true,
      inputPayload: true,
    },
  });

  const latestByNode = new Map<string, string>();
  for (const t of tasks) {
    if (!isRecoverableCanvasVideoTask(t)) continue;
    if (!latestByNode.has(t.nodeId)) latestByNode.set(t.nodeId, t.id);
  }

  const stuck = await findCanvasVideoTasksNeedingRecovery({ projectId });
  const taskIds = new Set<string>();
  for (const id of latestByNode.values()) taskIds.add(id);
  for (const c of stuck) taskIds.add(c.taskId);

  const results: CanvasVideoRecoverResult[] = [];
  for (const taskId of taskIds) {
    results.push(await recoverCanvasVideoTaskDisplay(taskId));
  }
  return results;
}

function nodeDataNeedsMediaReconcile(
  nodeType: string | undefined,
  data:
    | {
        ossUrl?: string;
        runtime?: CanvasNodeRuntimeLike;
      }
    | undefined,
): boolean {
  if (!CANVAS_MEDIA_NODE_TYPES.has(nodeType ?? "")) return false;
  const url =
    data?.runtime?.ossUrl?.trim() ||
    data?.runtime?.ephemeralUrl?.trim() ||
    data?.ossUrl?.trim();
  if (url && data?.runtime?.status === "done") return false;
  const st = data?.runtime?.status;
  if (st !== "running" && st !== "pending") return false;
  return !url;
}

export type CanvasMediaRuntimeReconcileResult = {
  patched: number;
  /** 内存中已修补的 canvas；无变更时为 null */
  canvas: unknown | null;
};

/**
 * 打开画布时批量修复：节点卡在 running/pending 且无成片，但库内已有 SUCCEEDED 任务。
 * 传入 `canvasIn` 可避免重复读库；单次 findMany + 单次写库。
 */
export async function reconcileStaleCanvasMediaRuntimeOnProjectRead(
  projectId: string,
  canvasIn?: unknown,
): Promise<CanvasMediaRuntimeReconcileResult> {
  let canvas = canvasIn;
  if (!canvas) {
    const project = await prisma.canvasProject.findUnique({
      where: { id: projectId, deletedAt: null },
      select: { canvas: true },
    });
    canvas = project?.canvas;
  }
  if (!canvas) return { patched: 0, canvas: null };

  const nodes =
    (
      canvas as {
        nodes?: Array<{
          id: string;
          type?: string;
          data?: { ossUrl?: string; runtime?: CanvasNodeRuntimeLike };
        }>;
      } | null
    )?.nodes ?? [];

  const staleNodes = nodes.filter((n) =>
    nodeDataNeedsMediaReconcile(n.type, n.data),
  );
  if (staleNodes.length === 0) return { patched: 0, canvas: null };

  const staleNodeIds = staleNodes.map((n) => n.id);
  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      projectId,
      nodeId: { in: staleNodeIds },
      deletedAt: null,
      status: "SUCCEEDED",
      OR: [{ ossUrl: { not: null } }, { ephemeralUrl: { not: null } }],
    },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      projectId: true,
      nodeId: true,
      ossUrl: true,
      ephemeralUrl: true,
      completedAt: true,
      resultPayload: true,
      inputPayload: true,
    },
  });

  const latestByNode = new Map<string, (typeof tasks)[number]>();
  for (const t of tasks) {
    if (!latestByNode.has(t.nodeId)) latestByNode.set(t.nodeId, t);
  }

  let nextCanvas: unknown = canvas;
  let patched = 0;
  let thumbCandidate: string | undefined;
  for (const node of staleNodes) {
    const task = latestByNode.get(node.id);
    if (!task) continue;
    if (
      CANVAS_VIDEO_MEDIA_NODE_TYPES.has(node.type ?? "") &&
      !isRecoverableCanvasVideoTask(task)
    ) {
      continue;
    }
    const mediaUrl = task.ossUrl?.trim() || task.ephemeralUrl?.trim();
    if (!mediaUrl) continue;
    const runtime = buildMediaRuntimePatchFromTask(task, mediaUrl);
    nextCanvas = patchCanvasJsonNodeMedia(
      nextCanvas,
      node.id,
      node.type,
      mediaUrl,
      runtime,
    );
    patched += 1;
    const poster =
      runtime.posterUrl || task.ossUrl?.trim() || undefined;
    if (poster && !thumbCandidate) thumbCandidate = poster;
  }

  if (patched === 0) return { patched: 0, canvas: null };

  const projectRow = await prisma.canvasProject.findUnique({
    where: { id: projectId },
    select: { thumbnailUrl: true },
  });
  const data: Prisma.CanvasProjectUpdateInput = {
    canvas: nextCanvas as Prisma.InputJsonValue,
  };
  if (!projectRow?.thumbnailUrl && thumbCandidate) {
    data.thumbnailUrl = thumbCandidate;
  }
  await prisma.canvasProject.update({
    where: { id: projectId },
    data,
  });

  return { patched, canvas: nextCanvas };
}

/** @deprecated 使用 reconcileStaleCanvasMediaRuntimeOnProjectRead */
export async function reconcileStaleCanvasVideoRuntimeOnProjectRead(
  projectId: string,
): Promise<number> {
  const r = await reconcileStaleCanvasMediaRuntimeOnProjectRead(projectId);
  return r.patched;
}

export type CanvasDisplayReconcileSummary = {
  candidates: number;
  recovered: number;
  noop: number;
  failed: number;
  actions: Record<CanvasVideoRecoverAction, number>;
};

/**
 * 定时 / poll 收尾：扫描需恢复的画布视频任务并自动写回（Gateway 已成功、SUCCEEDED 未 patch 等）。
 */
export async function runCanvasDisplayReconcileWorker(opts?: {
  limit?: number;
  since?: Date;
}): Promise<CanvasDisplayReconcileSummary> {
  const limit = opts?.limit ?? 30;
  const candidates = await findCanvasVideoTasksNeedingRecovery({
    limit,
    since: opts?.since,
  });
  const actions: Record<CanvasVideoRecoverAction, number> = {
    patched_runtime: 0,
    applied_from_gateway: 0,
    recovered_vendor: 0,
    noop: 0,
    failed: 0,
  };
  let recovered = 0;
  let failed = 0;

  for (const c of candidates) {
    const r = await recoverCanvasVideoTaskDisplay(c.taskId);
    actions[r.action] += 1;
    if (r.ok && r.action !== "noop" && r.action !== "failed") recovered += 1;
    if (!r.ok || r.action === "failed") failed += 1;
  }

  return {
    candidates: candidates.length,
    recovered,
    noop: actions.noop,
    failed,
    actions,
  };
}
