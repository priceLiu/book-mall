/**
 * 画布 · 火山 Seedance 视频：超时误杀恢复 + 项目节点 runtime 回写。
 */
import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { persistCanvasKieResultToOss, persistCanvasVideoResultToOss } from "@/lib/canvas/canvas-oss";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";
import {
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
} from "@/lib/gateway/volcengine-client";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { extractPosterUrlFromResultPayload, mergeResultPayloadPoster } from "@/lib/canvas/video-poster-ffmpeg";
import { prisma } from "@/lib/prisma";

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> | null {
  if (!task.inputPayload || typeof task.inputPayload !== "object") return null;
  return task.inputPayload as Record<string, unknown>;
}

export type CanvasNodeRuntimePatch = {
  status: "done";
  taskId: string;
  ossUrl: string;
  ephemeralUrl?: string;
  posterUrl?: string;
  failCode?: undefined;
  failMessage?: undefined;
  dismissedFailTaskId?: undefined;
};

export function patchCanvasJsonNodeRuntime(
  canvas: unknown,
  nodeId: string,
  runtime: CanvasNodeRuntimePatch,
): unknown {
  if (!canvas || typeof canvas !== "object") return canvas;
  const c = canvas as {
    nodes?: Array<{ id: string; data?: Record<string, unknown> }>;
  };
  if (!Array.isArray(c.nodes)) return canvas;
  return {
    ...(canvas as object),
    nodes: c.nodes.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...(n.data ?? {}), runtime } }
        : n,
    ),
  };
}

async function pollVendorVideoUrl(input: {
  credentialId: string;
  taskId: string;
}): Promise<{ videoUrl: string | null; raw: unknown; status: string }> {
  const cred = await getDecryptedCredentialApiKey(input.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const polled = await volcengineGetVideoTask({
    apiKey: resolveVolcengineArkApiKey(cred.apiKey),
    baseUrl: cred.baseUrl,
    taskId: input.taskId,
  });
  return {
    videoUrl: polled.output.content?.video_url ?? null,
    raw: polled.raw,
    status: polled.output.status,
  };
}

async function reopenTimedOutTaskForApply(taskId: string): Promise<boolean> {
  const r = await prisma.canvasGenerationTask.updateMany({
    where: {
      id: taskId,
      status: "FAILED",
      failCode: {
        in: [
          "timeout",
          "timeout_vendor_running",
          "timeout_poll_error",
          "timeout_gateway_sync",
          "timeout_no_gateway",
          "OSS_UPLOAD_FAILED",
        ],
      },
    },
    data: {
      status: "SUBMITTED",
      failCode: null,
      failMessage: null,
      completedAt: null,
    },
  });
  return r.count > 0;
}

/** 恢复路径：OSS 失败时仍保留厂商 ephemeralUrl，避免二次误杀。 */
async function applyRecoveredVideoResult(
  taskId: string,
  videoUrl: string,
): Promise<{ ok: boolean; failCode?: string }> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) return { ok: false, failCode: "task_not_found" };

  let ossUrl: string | null = null;
  let posterUrl: string | undefined;
  try {
    const persisted = await persistCanvasVideoResultToOss({
      ephemeralUrl: videoUrl,
      projectId: task.projectId,
    });
    ossUrl = persisted.videoUrl;
    posterUrl = persisted.posterUrl;
  } catch {
    try {
      ossUrl = await persistCanvasKieResultToOss({
        ephemeralUrl: videoUrl,
        kind: "node-video",
        projectId: task.projectId,
      });
    } catch {
      // 本地/临时环境 OSS 未配时仍用厂商 URL 恢复画布展示
    }
  }

  await prisma.canvasGenerationTask.update({
    where: { id: taskId },
    data: {
      status: "SUCCEEDED",
      ossUrl: ossUrl ?? undefined,
      ephemeralUrl: videoUrl,
      resultPayload: mergeResultPayloadPoster(null, posterUrl) as Prisma.InputJsonValue,
      completedAt: new Date(),
      failCode: null,
      failMessage: null,
    },
  });
  return { ok: true };
}

async function finalizeGatewaySuccess(input: {
  gatewayLogId: string;
  taskId: string;
  videoUrl: string;
  raw: unknown;
  submittedAt: Date | null;
}): Promise<void> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: input.gatewayLogId },
  });
  if (!log) return;

  const durationMs = log.submittedAt
    ? Math.max(0, Date.now() - log.submittedAt.getTime())
    : 0;

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs,
    failCode: undefined,
    failMessage: undefined,
    resultSummary: buildGatewayTaskResultSummary(input.raw, {
      videoUrl: input.videoUrl,
    }),
    externalTaskId: input.taskId,
    model: log.model,
  });
}

export async function patchCanvasProjectNodeRuntimeFromTask(
  task: Pick<
    CanvasGenerationTask,
    | "id"
    | "projectId"
    | "nodeId"
    | "ossUrl"
    | "ephemeralUrl"
    | "completedAt"
    | "resultPayload"
  >,
): Promise<void> {
  return patchProjectNodeFromTask(task);
}

async function patchProjectNodeFromTask(
  task: Pick<
    CanvasGenerationTask,
    | "id"
    | "projectId"
    | "nodeId"
    | "ossUrl"
    | "ephemeralUrl"
    | "completedAt"
    | "resultPayload"
  >,
): Promise<void> {
  const mediaUrl = task.ossUrl?.trim() || task.ephemeralUrl?.trim();
  if (!mediaUrl) return;
  const project = await prisma.canvasProject.findUnique({
    where: { id: task.projectId },
    select: { canvas: true, thumbnailUrl: true },
  });
  if (!project?.canvas) return;

  const canvas = project.canvas as {
    nodes?: Array<{ id: string; data?: { runtime?: { taskId?: string } } }>;
  };
  const node = canvas.nodes?.find((n) => n.id === task.nodeId);
  const existingTaskId = node?.data?.runtime?.taskId?.trim();
  const existingStatus = (
    node?.data?.runtime as { status?: string } | undefined
  )?.status;
  if (
    existingTaskId &&
    existingTaskId !== task.id &&
    existingStatus === "done"
  ) {
    const existing = await prisma.canvasGenerationTask.findUnique({
      where: { id: existingTaskId },
      select: { completedAt: true, status: true },
    });
    if (
      existing?.status === "SUCCEEDED" &&
      existing.completedAt &&
      task.completedAt &&
      existing.completedAt.getTime() > task.completedAt.getTime()
    ) {
      return;
    }
  }

  const posterUrl = extractPosterUrlFromResultPayload(task.resultPayload) ?? undefined;
  const runtime: CanvasNodeRuntimePatch = {
    status: "done",
    taskId: task.id,
    ossUrl: task.ossUrl?.trim() || mediaUrl,
    ephemeralUrl: task.ephemeralUrl ?? undefined,
    ...(posterUrl ? { posterUrl } : {}),
  };
  const nextCanvas = patchCanvasJsonNodeRuntime(
    project.canvas,
    task.nodeId,
    runtime,
  );
  const thumb = posterUrl || task.ossUrl?.trim();
  const data: Prisma.CanvasProjectUpdateInput = {
    canvas: nextCanvas as Prisma.InputJsonValue,
  };
  if (!project.thumbnailUrl && thumb) {
    data.thumbnailUrl = thumb;
  }
  await prisma.canvasProject.update({
    where: { id: task.projectId },
    data,
  });
}

/** 恢复误标 timeout 且厂商已成功的画布视频任务。 */
export async function recoverCanvasVolcengineTimedOutTask(
  taskId: string,
): Promise<{ ok: boolean; reason?: string; ossUrl?: string }> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: { select: { userId: true } } },
  });
  if (!task) return { ok: false, reason: "task_not_found" };
  if (task.status === "SUCCEEDED" && (task.ossUrl || task.ephemeralUrl)) {
    await patchProjectNodeFromTask(task);
    return { ok: true, ossUrl: task.ossUrl ?? task.ephemeralUrl ?? undefined };
  }
  if (
    task.status !== "FAILED" ||
    !task.failCode ||
    ![
      "timeout",
      "timeout_vendor_running",
      "timeout_poll_error",
      "timeout_gateway_sync",
      "timeout_no_gateway",
      "OSS_UPLOAD_FAILED",
    ].includes(task.failCode)
  ) {
    return { ok: false, reason: `status=${task.status} failCode=${task.failCode}` };
  }

  const payload = taskInputPayload(task);
  const gatewayLogId =
    typeof payload?.gatewayLogId === "string"
      ? payload.gatewayLogId.trim()
      : "";
  const vendorTaskId = task.kieTaskId?.trim();
  if (!vendorTaskId || !gatewayLogId) {
    return { ok: false, reason: "missing_gateway_refs" };
  }

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: { credentialId: true, submittedAt: true },
  });
  if (!log?.credentialId) return { ok: false, reason: "missing_credential" };

  let vendor: Awaited<ReturnType<typeof pollVendorVideoUrl>>;
  try {
    vendor = await pollVendorVideoUrl({
      credentialId: log.credentialId,
      taskId: vendorTaskId,
    });
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  if (!isVolcengineVideoTaskSuccess({ status: vendor.status, id: vendorTaskId })) {
    return {
      ok: false,
      reason: `vendor_status=${vendor.status}`,
    };
  }
  if (!vendor.videoUrl?.trim()) {
    return { ok: false, reason: "vendor_no_video_url" };
  }

  await reopenTimedOutTaskForApply(taskId);
  const applied = await applyRecoveredVideoResult(taskId, vendor.videoUrl);
  if (!applied.ok) {
    return { ok: false, reason: applied.failCode ?? "apply_failed" };
  }

  const updated = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      ossUrl: true,
      ephemeralUrl: true,
      nodeId: true,
      projectId: true,
      failCode: true,
      completedAt: true,
      resultPayload: true,
    },
  });
  if (updated?.status !== "SUCCEEDED" || !(updated.ossUrl || updated.ephemeralUrl)) {
    return {
      ok: false,
      reason: updated?.failCode ?? "apply_failed",
    };
  }

  await finalizeGatewaySuccess({
    gatewayLogId,
    taskId: vendorTaskId,
    videoUrl: vendor.videoUrl,
    raw: vendor.raw,
    submittedAt: log.submittedAt,
  });
  await patchProjectNodeFromTask(updated);

  return { ok: true, ossUrl: updated.ossUrl ?? updated.ephemeralUrl ?? undefined };
}

/** 从 Gateway 终态 resultSummary 提取火山 video_url（免二次 recordInfo） */
export function extractVolcengineVideoUrlFromGatewaySummary(
  summary: unknown,
): string | null {
  if (!summary || typeof summary !== "object") return null;
  const root = summary as Record<string, unknown>;
  if (typeof root.videoUrl === "string" && root.videoUrl.trim()) {
    return root.videoUrl.trim();
  }
  const readContent = (obj: Record<string, unknown>): string | null => {
    const content = obj.content;
    if (!content || typeof content !== "object") return null;
    const url = (content as { video_url?: unknown }).video_url;
    return typeof url === "string" && url.trim() ? url.trim() : null;
  };
  const direct = readContent(root);
  if (direct) return direct;
  const output = root.output;
  if (output && typeof output === "object") {
    const nested = readContent(output as Record<string, unknown>);
    if (nested) return nested;
  }
  if (typeof root.result_url === "string" && root.result_url.trim()) {
    return root.result_url.trim();
  }
  return null;
}
