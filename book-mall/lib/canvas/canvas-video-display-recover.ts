/**
 * 画布视频 · 任务已成功但节点 runtime 未写回 / Gateway 已成功但 canvas 任务仍 SUBMITTED。
 */
import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { isCanvasVolcengineVideoTaskPayload } from "@/lib/canvas/canvas-constants";
import { applyCanvasVolcengineVideoResult } from "@/lib/canvas/canvas-task-service";
import {
  extractVolcengineVideoUrlFromGatewaySummary,
  patchCanvasProjectNodeRuntimeFromTask,
  recoverCanvasVolcengineTimedOutTask,
} from "@/lib/canvas/canvas-volcengine-recover";
import { recoverVolcengineGatewayLogFromVendor } from "@/lib/gateway/volcengine-stall-recover";
import { isRecoverableVolcengineStallFailCode } from "@/lib/gateway/video-background-generation";

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

function isVolcengineVideoCanvasTask(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): boolean {
  return isCanvasVolcengineVideoTaskPayload(taskInputPayload(task));
}

export function canvasNodeRuntimeShowsVideo(
  canvas: unknown,
  nodeId: string,
  taskId?: string,
): boolean {
  if (!canvas || typeof canvas !== "object") return false;
  const nodes = (canvas as { nodes?: Array<{ id: string; data?: unknown }> })
    .nodes;
  const node = nodes?.find((n) => n.id === nodeId);
  const rt = (node?.data as { runtime?: CanvasNodeRuntimeLike })?.runtime;
  if (!rt || rt.status !== "done") return false;
  if (!(rt.ossUrl?.trim() || rt.ephemeralUrl?.trim())) return false;
  if (taskId && rt.taskId && rt.taskId !== taskId) return false;
  return true;
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
  if (!isVolcengineVideoCanvasTask(task)) {
    return {
      ok: false,
      action: "failed",
      reason: "not_volcengine_video_task",
      taskId,
      projectId: task.projectId,
      nodeId: task.nodeId,
    };
  }

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
      canvasNodeRuntimeShowsVideo(task.project.canvas, task.nodeId, task.id)
    ) {
      return { ok: true, action: "noop", ...base, ossUrl: task.ossUrl ?? task.ephemeralUrl ?? undefined };
    }
    await patchCanvasProjectNodeRuntimeFromTask(task);
    return {
      ok: true,
      action: "patched_runtime",
      ...base,
      ossUrl: task.ossUrl ?? task.ephemeralUrl ?? undefined,
    };
  }

  const payload = taskInputPayload(task);
  const gatewayLogId =
    typeof payload?.gatewayLogId === "string"
      ? payload.gatewayLogId.trim()
      : "";
  if (gatewayLogId) {
    const log = await loadGatewayLog(gatewayLogId);
    if (log?.status === "SUCCEEDED") {
      const videoUrl = extractVolcengineVideoUrlFromGatewaySummary(
        log.resultSummary,
      );
      if (videoUrl) {
        await applyCanvasVolcengineVideoResult(task.id, videoUrl);
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
    ].includes(task.failCode)
  ) {
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

/** 扫描需恢复的画布视频任务（SUCCEEDED 未写 runtime / SUBMITTED+Gateway 已成功 / timeout FAILED） */
export async function findCanvasVideoTasksNeedingRecovery(opts?: {
  projectId?: string;
  since?: Date;
  limit?: number;
}): Promise<CanvasVideoRecoverCandidate[]> {
  const since =
    opts?.since ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const limit = opts?.limit ?? 500;

  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      createdAt: { gte: since },
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      projectId: true,
      nodeId: true,
      status: true,
      failCode: true,
      ossUrl: true,
      ephemeralUrl: true,
      inputPayload: true,
      project: { select: { name: true, canvas: true } },
    },
  });

  const out: CanvasVideoRecoverCandidate[] = [];

  for (const t of tasks) {
    if (!isVolcengineVideoCanvasTask(t)) continue;

    const payload = taskInputPayload(t);
    const gwId =
      typeof payload?.gatewayLogId === "string"
        ? payload.gatewayLogId.trim()
        : "";
    let gatewayStatus: string | null = null;
    let gatewayDurationSec: number | null = null;
    let pollDelayMs: number | null = null;
    if (gwId) {
      const gl = await prisma.gatewayRequestLog.findUnique({
        where: { id: gwId },
        select: { status: true, durationMs: true, resultSummary: true },
      });
      gatewayStatus = gl?.status ?? null;
      gatewayDurationSec = gl?.durationMs
        ? Math.round(gl.durationMs / 1000)
        : null;
      const tb = (gl?.resultSummary as Record<string, unknown> | null)
        ?._gateway as { timingBreakdown?: { pollDelayMs?: number } } | undefined;
      pollDelayMs = tb?.timingBreakdown?.pollDelayMs ?? null;
    }

    const canvas = t.project.canvas;
    const node = (
      canvas as {
        nodes?: Array<{ id: string; data?: { runtime?: CanvasNodeRuntimeLike } }>;
      } | null
    )?.nodes?.find((n) => n.id === t.nodeId);
    const rt = node?.data?.runtime;
    const media = Boolean(t.ossUrl?.trim() || t.ephemeralUrl?.trim());
    const runtimeOk = canvasNodeRuntimeShowsVideo(canvas, t.nodeId, t.id);

    const needsRecovery =
      (t.status === "SUBMITTED" && gatewayStatus === "SUCCEEDED") ||
      (t.status === "FAILED" &&
        t.failCode != null &&
        (t.failCode.startsWith("timeout") ||
          t.failCode === "VOLCENGINE_GATEWAY_POLL_STALL" ||
          t.failCode === "GATEWAY_TASK_FAILED")) ||
      (t.status === "SUCCEEDED" && media && !runtimeOk) ||
      (gatewayStatus === "SUCCEEDED" && !runtimeOk && !media);

    if (!needsRecovery) continue;

    out.push({
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
    });
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
    if (!isVolcengineVideoCanvasTask(t)) continue;
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
