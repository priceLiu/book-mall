/**
 * 火山视频 · 向厂商复核并恢复（历史误杀 / 后台生成完成后收口）。
 */
import { recoverCanvasVideoTaskDisplay } from "@/lib/canvas/canvas-video-display-recover";
import { applyCanvasVolcengineVideoResult } from "@/lib/canvas/canvas-task-service";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import { persistVolcengineTimingOnPoll } from "@/lib/gateway/log-volcengine-timing-persist";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
  volcengineVideoTaskFailMessage,
} from "@/lib/gateway/volcengine-client";
import {
  isRecoverableVolcengineStallFailCode,
  readVideoBackgroundGeneration,
  VOLCENGINE_RECOVERABLE_STALL_FAIL_CODES,
} from "@/lib/gateway/video-background-generation";
import { prisma } from "@/lib/prisma";

export type VolcengineGatewayRecoverResult = {
  ok: boolean;
  action:
    | "succeeded"
    | "vendor_failed"
    | "still_running"
    | "not_found"
    | "no_task_id"
    | "skipped";
  message: string;
  gatewayStatus?: string;
  videoUrl?: string;
};

async function findCanvasTaskIdByGatewayLog(gatewayLogId: string): Promise<string | null> {
  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      status: { in: ["SUBMITTED", "PENDING", "FAILED", "SUCCEEDED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: { id: true, inputPayload: true },
  });
  for (const t of tasks) {
    const p =
      t.inputPayload && typeof t.inputPayload === "object"
        ? (t.inputPayload as Record<string, unknown>)
        : null;
    if (p?.gatewayLogId === gatewayLogId) return t.id;
  }
  return null;
}

async function syncCanvasAfterGatewayRecover(
  gatewayLogId: string,
  videoUrl: string | null | undefined,
): Promise<void> {
  const canvasTaskId = await findCanvasTaskIdByGatewayLog(gatewayLogId);
  if (!canvasTaskId) return;
  if (videoUrl?.trim()) {
    await applyCanvasVolcengineVideoResult(canvasTaskId, videoUrl);
  } else {
    await recoverCanvasVideoTaskDisplay(canvasTaskId);
  }
}

/** 对单条 Gateway 日志 poll 厂商：succeeded → 收口；vendor failed → FAILED；running → 继续等 */
export async function recoverVolcengineGatewayLogFromVendor(
  gatewayLogId: string,
): Promise<VolcengineGatewayRecoverResult> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: {
      id: true,
      status: true,
      failCode: true,
      externalTaskId: true,
      credentialId: true,
      submittedAt: true,
      completedAt: true,
      resultSummary: true,
      lastPolledAt: true,
      providerKind: true,
      requestKind: true,
    },
  });

  if (!log) {
    return { ok: false, action: "not_found", message: "gateway_log_not_found" };
  }
  if (log.providerKind !== "VOLCENGINE" || log.requestKind !== "VIDEO") {
    return { ok: false, action: "skipped", message: "not_volcengine_video" };
  }
  if (log.status === "SUCCEEDED") {
    return {
      ok: true,
      action: "succeeded",
      message: "already_succeeded",
      gatewayStatus: log.status,
    };
  }
  if (
    log.status === "FAILED" &&
    log.failCode &&
    !isRecoverableVolcengineStallFailCode(log.failCode) &&
    log.failCode !== "VOLCENGINE_TASK_FAILED"
  ) {
    return {
      ok: false,
      action: "skipped",
      message: `status_${log.status}_failCode_${log.failCode}`,
      gatewayStatus: log.status,
    };
  }

  const taskId = log.externalTaskId?.trim();
  if (!taskId) {
    return { ok: false, action: "no_task_id", message: "missing_external_task_id" };
  }
  if (!log.credentialId) {
    return { ok: false, action: "skipped", message: "missing_credential" };
  }

  const cred = await getDecryptedCredentialApiKey(log.credentialId);
  if (!cred) {
    return { ok: false, action: "skipped", message: "credential_unavailable" };
  }

  let polled: Awaited<ReturnType<typeof volcengineGetVideoTask>>;
  try {
    polled = await volcengineGetVideoTask({
      apiKey: resolveVolcengineArkApiKey(cred.apiKey),
      baseUrl: cred.baseUrl,
      taskId,
    });
  } catch (e) {
    return {
      ok: false,
      action: "still_running",
      message: e instanceof Error ? e.message : String(e),
      gatewayStatus: log.status,
    };
  }

  const row = polled.output;
  const vendorStatus = String(row.status ?? "running");
  const startedAt = log.submittedAt.getTime();

  if (isVolcengineVideoTaskSuccess(row)) {
    const videoUrl = row.content?.video_url;
    const baseSummary = buildGatewayTaskResultSummary(
      polled.raw,
      videoUrl ? { videoUrl } : { status: row.status },
    );
    const { resultSummary } = await persistVolcengineTimingOnPoll({
      log: {
        id: log.id,
        submittedAt: log.submittedAt,
        completedAt: log.completedAt,
        resultSummary: log.resultSummary,
        status: log.status,
        lastPolledAt: log.lastPolledAt,
      },
      vendorStatus,
      vendorRaw: polled.raw,
      resultSummaryOverride: baseSummary,
    });
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: Date.now() - startedAt,
      resultSummary,
      externalTaskId: taskId,
    });
    await syncCanvasAfterGatewayRecover(log.id, videoUrl);
    return {
      ok: true,
      action: "succeeded",
      message: "recovered_from_vendor",
      gatewayStatus: "SUCCEEDED",
      videoUrl: videoUrl ?? undefined,
    };
  }

  if (isVolcengineVideoTaskFailed(row)) {
    const { resultSummary } = await persistVolcengineTimingOnPoll({
      log: {
        id: log.id,
        submittedAt: log.submittedAt,
        completedAt: log.completedAt,
        resultSummary: log.resultSummary,
        status: log.status,
        lastPolledAt: log.lastPolledAt,
      },
      vendorStatus,
      vendorRaw: polled.raw,
      resultSummaryOverride: buildGatewayTaskResultSummary(polled.raw, {
        status: row.status,
        error: row.error,
      }),
    });
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - startedAt,
      failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
      failCode: "VOLCENGINE_TASK_FAILED",
      externalTaskId: taskId,
      resultSummary,
    });
    return {
      ok: true,
      action: "vendor_failed",
      message: volcengineVideoTaskFailMessage(row),
      gatewayStatus: "FAILED",
    };
  }

  await persistVolcengineTimingOnPoll({
    log: {
      id: log.id,
      submittedAt: log.submittedAt,
      completedAt: log.completedAt,
      resultSummary: log.resultSummary,
      status: "RUNNING",
      lastPolledAt: log.lastPolledAt,
    },
    vendorStatus,
    vendorRaw: polled.raw,
  });

  const bg = readVideoBackgroundGeneration(log.resultSummary);
  return {
    ok: false,
    action: "still_running",
    message: bg?.slotReleased
      ? "vendor_still_running_background"
      : "vendor_still_running",
    gatewayStatus: "RUNNING",
  };
}

/** 批量复核历史误杀（FAILED · VOLCENGINE_GATEWAY_POLL_STALL） */
export async function recoverMisclassifiedVolcengineStallLogs(opts?: {
  limit?: number;
}): Promise<{ scanned: number; recovered: number }> {
  const limit = opts?.limit ?? 30;
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "FAILED",
      failCode: { in: [...VOLCENGINE_RECOVERABLE_STALL_FAIL_CODES] },
      externalTaskId: { not: null },
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
    },
    orderBy: { completedAt: "desc" },
    take: limit,
    select: { id: true },
  });

  let recovered = 0;
  for (const row of rows) {
    const r = await recoverVolcengineGatewayLogFromVendor(row.id);
    if (r.ok && r.action === "succeeded") recovered++;
  }
  return { scanned: rows.length, recovered };
}
