import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import {
  buildSubmitFailureFinalizePayload,
  runGatewaySubmitWithRetry,
} from "@/lib/gateway/gateway-submit-error-policy";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";
import { resolveVolcengineModelKey } from "@/lib/gateway/volcengine-chat-models";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
  volcengineCreateVideoTask,
  volcengineGetVideoTask,
  volcengineVideoTaskFailMessage,
} from "@/lib/gateway/volcengine-client";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import {
  finalizeVolcengineVideoRequestLog,
  persistVolcengineTimingOnPoll,
} from "@/lib/gateway/log-volcengine-timing-persist";
import { readVolcengineTimingTrace } from "@/lib/gateway/log-volcengine-timing";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";

export async function submitVolcengineVideoJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  body: Record<string, unknown>;
}): Promise<string> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");

  const upstreamModel = resolveVolcengineModelKey(opts.model);
  const content = Array.isArray(opts.body.content)
    ? opts.body.content
    : opts.body.prompt
      ? [{ type: "text", text: String(opts.body.prompt) }]
      : [{ type: "text", text: "" }];

  const payload: Record<string, unknown> = {
    ...opts.body,
    model: upstreamModel,
    content,
  };
  delete payload.prompt;

  try {
    const { taskId, requestId } = await runGatewaySubmitWithRetry(() =>
      volcengineCreateVideoTask({
        apiKey: resolveVolcengineArkApiKey(cred.apiKey),
        baseUrl: cred.baseUrl,
        model: opts.model,
        body: payload,
      }),
    );

    const { prisma } = await import("@/lib/prisma");
    await prisma.gatewayRequestLog.update({
      where: { id: opts.logId },
      data: {
        externalTaskId: taskId,
        ...(requestId ? { vendorRequestId: requestId } : {}),
      },
    });

    return taskId;
  } catch (e) {
    const finalizePayload = await buildSubmitFailureFinalizePayload(e);
    await finalizeRequestLog(opts.logId, finalizePayload).catch(() => undefined);
    throw e;
  }
}

export async function pollVolcengineVideoTaskForLog(opts: {
  logId: string;
  credentialId: string;
  taskId: string;
  startedAt: number;
}): Promise<"pending" | "done"> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) {
    await finalizeRequestLog(opts.logId, {
      status: "FAILED",
      durationMs: Date.now() - opts.startedAt,
      failMessage: "凭证不可用",
      failCode: "CREDENTIAL_MISSING",
    });
    return "done";
  }

  const polled = await volcengineGetVideoTask({
    apiKey: resolveVolcengineArkApiKey(cred.apiKey),
    baseUrl: cred.baseUrl,
    taskId: opts.taskId,
  });
  const row = polled.output;
  const { prisma } = await import("@/lib/prisma");
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: opts.logId },
    select: {
      id: true,
      submittedAt: true,
      completedAt: true,
      resultSummary: true,
      status: true,
      lastPolledAt: true,
    },
  });
  if (!log) return "done";

  const vendorStatus = String(row.status ?? "running");

  if (isVolcengineVideoTaskSuccess(row)) {
    const videoUrl = row.content?.video_url;
    const baseSummary = buildGatewayTaskResultSummary(
      polled.raw,
      videoUrl ? { videoUrl } : { status: row.status },
    );
    const { resultSummary } = await persistVolcengineTimingOnPoll({
      log,
      vendorStatus,
      vendorRaw: polled.raw,
      resultSummaryOverride: baseSummary,
    });
    const trace = readVolcengineTimingTrace(resultSummary);
    if (trace) {
      await finalizeVolcengineVideoRequestLog(opts.logId, {
        submittedAt: log.submittedAt,
        status: "SUCCEEDED",
        trace,
        resultSummaryBase: resultSummary,
        externalTaskId: opts.taskId,
      });
    } else {
      await finalizeRequestLog(opts.logId, {
        status: "SUCCEEDED",
        durationMs: Date.now() - opts.startedAt,
        resultSummary,
        externalTaskId: opts.taskId,
      });
    }
    return "done";
  }

  if (isVolcengineVideoTaskFailed(row)) {
    const { resultSummary } = await persistVolcengineTimingOnPoll({
      log,
      vendorStatus,
      vendorRaw: polled.raw,
      resultSummaryOverride: buildGatewayTaskResultSummary(polled.raw, {
        status: row.status,
        error: row.error,
      }),
    });
    const trace = readVolcengineTimingTrace(resultSummary);
    if (trace) {
      await finalizeVolcengineVideoRequestLog(opts.logId, {
        submittedAt: log.submittedAt,
        status: "FAILED",
        trace,
        resultSummaryBase: resultSummary,
        failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
        failCode: "VOLCENGINE_TASK_FAILED",
        externalTaskId: opts.taskId,
      });
    } else {
      await finalizeRequestLog(opts.logId, {
        status: "FAILED",
        durationMs: Date.now() - opts.startedAt,
        failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
        failCode: "VOLCENGINE_TASK_FAILED",
        externalTaskId: opts.taskId,
        resultSummary,
      });
    }
    return "done";
  }

  await persistVolcengineTimingOnPoll({
    log,
    vendorStatus,
    vendorRaw: polled.raw,
  });

  const after = await prisma.gatewayRequestLog.findUnique({
    where: { id: opts.logId },
    select: { status: true },
  });
  if (after?.status !== "RUNNING") return "done";

  return "pending";
}
