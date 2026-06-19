import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskInProgress,
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
} from "@/lib/gateway/volcengine-client";
import { prisma } from "@/lib/prisma";

/** 画布 SUBMITTED 超时根因（写入 resultPayload.pollTimeoutDiagnostic）。 */
export type CanvasPollTimeoutCause =
  | "vendor_still_running"
  | "vendor_already_succeeded"
  | "vendor_failed"
  | "poll_error"
  | "gateway_stuck_running"
  | "no_gateway_log"
  | "unknown";

export type CanvasPollTimeoutDiagnostic = {
  kind: "canvas_poll_timeout";
  at: string;
  waitedMs: number;
  timeoutMin: number;
  pollCount: number;
  cause: CanvasPollTimeoutCause;
  externalTaskId?: string;
  gatewayLogId?: string;
  gatewayLogStatus?: string;
  vendorStatus?: string;
  vendorHasVideoUrl?: boolean;
  finalPollError?: string;
  probeError?: string;
  note?: string;
};

export type CanvasPollTimeoutFailFields = {
  failCode: string;
  failMessage: string;
  resultPayload: Prisma.InputJsonValue;
};

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> | null {
  if (!task.inputPayload || typeof task.inputPayload !== "object") return null;
  return task.inputPayload as Record<string, unknown>;
}

function mergeResultPayload(
  existing: unknown,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

export function canvasPollTimeoutFailCode(cause: CanvasPollTimeoutCause): string {
  switch (cause) {
    case "vendor_still_running":
      return "timeout_vendor_running";
    case "vendor_already_succeeded":
      return "timeout_gateway_sync";
    case "vendor_failed":
      return "VOLCENGINE_TASK_FAILED";
    case "poll_error":
      return "timeout_poll_error";
    case "gateway_stuck_running":
      return "timeout_gateway_sync";
    case "no_gateway_log":
      return "timeout_no_gateway";
    default:
      return "timeout";
  }
}

export function canvasPollTimeoutFailMessage(
  diag: CanvasPollTimeoutDiagnostic,
): string {
  switch (diag.cause) {
    case "vendor_still_running":
      return `画布已等待 ${diag.timeoutMin} 分钟；火山任务仍在生成（status=${diag.vendorStatus ?? "running"}），请稍后在生成记录查看或重试`;
    case "vendor_already_succeeded":
      return "火山已返回成功，但轮询未及时同步到画布（可尝试刷新或联系支持恢复）";
    case "vendor_failed":
      return `火山任务已失败（status=${diag.vendorStatus ?? "failed"}）`;
    case "poll_error":
      return `轮询异常，未能确认厂商状态：${diag.finalPollError ?? diag.probeError ?? "unknown"}`;
    case "gateway_stuck_running":
      return `Gateway 日志仍为 RUNNING，厂商状态=${diag.vendorStatus ?? "unknown"}；可能同步延迟`;
    case "no_gateway_log":
      return "任务无 Gateway 日志，无法确认厂商状态";
    default:
      return `任务等待超过 ${diag.timeoutMin} 分钟仍未完成`;
  }
}

export function buildCanvasTimeoutFailFields(
  task: Pick<CanvasGenerationTask, "resultPayload">,
  diag: CanvasPollTimeoutDiagnostic,
): CanvasPollTimeoutFailFields {
  return {
    failCode: canvasPollTimeoutFailCode(diag.cause),
    failMessage: canvasPollTimeoutFailMessage(diag).slice(0, 500),
    resultPayload: mergeResultPayload(task.resultPayload, {
      pollTimeoutDiagnostic: diag,
    }),
  };
}

export function buildCanvasPollErrorPatch(
  task: Pick<CanvasGenerationTask, "resultPayload" | "pollCount">,
  errorMessage: string,
): { resultPayload: Prisma.InputJsonValue } {
  return {
    resultPayload: mergeResultPayload(task.resultPayload, {
      pollDiagnostics: {
        lastErrorAt: new Date().toISOString(),
        lastError: errorMessage.slice(0, 500),
        pollCount: task.pollCount,
      },
    }),
  };
}

async function probeVolcengineVendor(input: {
  credentialId: string;
  taskId: string;
}): Promise<{
  vendorStatus: string;
  videoUrl: string | null;
  probeError?: string;
}> {
  try {
    const cred = await getDecryptedCredentialApiKey(input.credentialId);
    if (!cred) return { vendorStatus: "unknown", videoUrl: null, probeError: "credential_unavailable" };
    const polled = await volcengineGetVideoTask({
      apiKey: resolveVolcengineArkApiKey(cred.apiKey),
      baseUrl: cred.baseUrl,
      taskId: input.taskId,
    });
    return {
      vendorStatus: polled.output.status,
      videoUrl: polled.output.content?.video_url ?? null,
    };
  } catch (e) {
    return {
      vendorStatus: "unknown",
      videoUrl: null,
      probeError: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function probeCanvasSubmittedTaskAtTimeout(input: {
  task: CanvasGenerationTask & { project: { userId: string } };
  timeoutMin: number;
  waitedMs: number;
  finalPollError?: string;
}): Promise<CanvasPollTimeoutDiagnostic & { videoUrl?: string | null }> {
  const { task, timeoutMin, waitedMs, finalPollError } = input;
  const payload = taskInputPayload(task);
  const gatewayLogId =
    typeof payload?.gatewayLogId === "string"
      ? payload.gatewayLogId.trim()
      : "";
  const externalTaskId = task.kieTaskId?.trim() ?? undefined;
  const providerKind =
    typeof payload?.providerKind === "string" ? payload.providerKind : undefined;

  const base: CanvasPollTimeoutDiagnostic = {
    kind: "canvas_poll_timeout",
    at: new Date().toISOString(),
    waitedMs,
    timeoutMin,
    pollCount: task.pollCount,
    cause: "unknown",
    externalTaskId,
    gatewayLogId: gatewayLogId || undefined,
    finalPollError: finalPollError?.slice(0, 500),
  };

  if (finalPollError && !gatewayLogId) {
    return { ...base, cause: "poll_error", probeError: finalPollError };
  }

  if (!gatewayLogId || !externalTaskId) {
    return { ...base, cause: "no_gateway_log" };
  }

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: { status: true, credentialId: true, resultSummary: true },
  });
  if (!log) {
    return { ...base, cause: "no_gateway_log", note: "gateway_log_not_found" };
  }

  base.gatewayLogStatus = log.status;

  if (providerKind === "VOLCENGINE" && log.credentialId) {
    const vendor = await probeVolcengineVendor({
      credentialId: log.credentialId,
      taskId: externalTaskId,
    });
    base.vendorStatus = vendor.vendorStatus;
    base.vendorHasVideoUrl = Boolean(vendor.videoUrl?.trim());
    if (vendor.probeError) base.probeError = vendor.probeError;

    const row = { status: vendor.vendorStatus, id: externalTaskId };
    if (isVolcengineVideoTaskSuccess(row)) {
      return {
        ...base,
        cause: "vendor_already_succeeded",
        videoUrl: vendor.videoUrl,
        note: log.status === "RUNNING" ? "gateway_log_still_running" : undefined,
      };
    }
    if (isVolcengineVideoTaskFailed(row)) {
      return { ...base, cause: "vendor_failed", videoUrl: null };
    }
    if (isVolcengineVideoTaskInProgress(row)) {
      return { ...base, cause: "vendor_still_running", videoUrl: null };
    }
  }

  if (finalPollError) {
    return { ...base, cause: "poll_error", probeError: finalPollError };
  }

  if (log.status === "RUNNING") {
    return {
      ...base,
      cause: "gateway_stuck_running",
      note: "vendor_probe_inconclusive",
    };
  }

  return base;
}
