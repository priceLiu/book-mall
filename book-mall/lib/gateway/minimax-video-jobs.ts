import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import {
  buildSubmitFailureFinalizePayload,
  runGatewaySubmitWithRetry,
} from "@/lib/gateway/gateway-submit-error-policy";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { buildMinimaxVideoSubmitBody } from "@/lib/gateway/minimax-video-body";
import {
  isMinimaxVideoTaskFailed,
  isMinimaxVideoTaskSuccess,
  minimaxQueryVideoTask,
  minimaxSubmitVideoTask,
  minimaxVideoTaskFailMessage,
  minimaxVideoTaskResultUrl,
  minimaxVideoTaskEnhancedPrompt,
  type MinimaxVideoTaskRow,
} from "@/lib/gateway/minimax-video-client";
import { resolveMinimaxVideoModel } from "@/lib/gateway/minimax-video-models";

export type MinimaxVideoPollResult = {
  state: "pending" | "running" | "succeeded" | "failed";
  videoUrl?: string;
  enhancedPrompt?: string;
  task: MinimaxVideoTaskRow;
  raw: unknown;
  errorMessage?: string;
};

export async function submitMinimaxVideoJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  input: Record<string, unknown>;
}): Promise<string> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred?.apiKey?.trim()) throw new Error("MiniMax 凭证不可用");

  const spec = resolveMinimaxVideoModel(opts.model);
  if (!spec) throw new Error(`不支持的 MiniMax 视频模型: ${opts.model}`);

  const body =
    opts.input.content && Array.isArray(opts.input.content)
      ? {
          model: opts.input.model ?? "MiniMax-H3",
          ...opts.input,
        }
      : buildMinimaxVideoSubmitBody({
          modelKey: opts.model,
          input: opts.input,
        });

  try {
    const { taskId, requestId } = await runGatewaySubmitWithRetry(() =>
      minimaxSubmitVideoTask({
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
        modelKey: opts.model,
        body,
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

export async function pollMinimaxVideoTaskForLog(opts: {
  logId?: string;
  credentialId: string;
  taskId: string;
  startedAt?: number;
}): Promise<"pending" | "done"> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred?.apiKey?.trim()) {
    if (opts.logId) {
      await finalizeRequestLog(opts.logId, {
        status: "FAILED",
        durationMs: opts.startedAt ? Date.now() - opts.startedAt : 0,
        failMessage: "MiniMax 凭证不可用",
        failCode: "CREDENTIAL_MISSING",
      });
    }
    return "done";
  }

  const polled = await minimaxQueryVideoTask({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    taskId: opts.taskId,
  });
  const row = polled.task;
  const vendorStatus = String(row.status ?? "running");

  if (!opts.logId) return isMinimaxVideoTaskSuccess(row) || isMinimaxVideoTaskFailed(row) ? "done" : "pending";

  const { prisma } = await import("@/lib/prisma");
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: opts.logId },
    select: {
      id: true,
      submittedAt: true,
      status: true,
      model: true,
    },
  });
  if (!log) return "done";

  if (isMinimaxVideoTaskSuccess(row)) {
    const videoUrl = minimaxVideoTaskResultUrl(row);
    const enhancedPrompt = minimaxVideoTaskEnhancedPrompt(row);
    const baseSummary = buildGatewayTaskResultSummary(polled.raw, {
      ...(videoUrl ? { videoUrl } : {}),
      ...(enhancedPrompt ? { enhancedPrompt } : {}),
      status: row.status,
      task_type: row.task_type,
      usage: row.usage,
    });
    await finalizeRequestLog(opts.logId, {
      status: "SUCCEEDED",
      durationMs: log.submittedAt
        ? Date.now() - log.submittedAt.getTime()
        : 0,
      resultSummary: baseSummary,
      externalTaskId: opts.taskId,
      model: log.model,
      usage: row.usage
        ? {
            totalTokens: row.usage.total_tokens,
            promptTokens: row.usage.prompt_tokens,
            completionTokens: row.usage.completion_tokens,
          }
        : undefined,
    });
    return "done";
  }

  if (isMinimaxVideoTaskFailed(row)) {
    await finalizeRequestLog(opts.logId, {
      status: "FAILED",
      durationMs: log.submittedAt
        ? Date.now() - log.submittedAt.getTime()
        : 0,
      failMessage: minimaxVideoTaskFailMessage(row),
      failCode: "MINIMAX_VIDEO_TASK_FAILED",
      externalTaskId: opts.taskId,
      model: log.model,
      resultSummary: buildGatewayTaskResultSummary(polled.raw, {
        status: row.status,
        error: row.error,
      }),
    });
    return "done";
  }

  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: {
      lastPolledAt: new Date(),
      pollCount: { increment: 1 },
    },
  });

  return "pending";
}

export async function pollMinimaxVideoTaskStatus(opts: {
  credentialId: string;
  taskId: string;
}): Promise<MinimaxVideoPollResult> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred?.apiKey?.trim()) throw new Error("MiniMax 凭证不可用");

  const polled = await minimaxQueryVideoTask({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    taskId: opts.taskId,
  });
  const task = polled.task;

  if (isMinimaxVideoTaskSuccess(task)) {
    return {
      state: "succeeded",
      videoUrl: minimaxVideoTaskResultUrl(task) ?? undefined,
      enhancedPrompt: minimaxVideoTaskEnhancedPrompt(task) ?? undefined,
      task,
      raw: polled.raw,
    };
  }
  if (isMinimaxVideoTaskFailed(task)) {
    return {
      state: "failed",
      task,
      raw: polled.raw,
      errorMessage: minimaxVideoTaskFailMessage(task),
    };
  }
  const s = String(task.status ?? "").toLowerCase();
  return {
    state: s === "queued" ? "pending" : "running",
    task,
    raw: polled.raw,
  };
}

export function extractMinimaxVideoUrlFromGatewaySummary(
  summary: unknown,
): string | null {
  if (!summary || typeof summary !== "object") return null;
  const o = summary as Record<string, unknown>;
  const direct = o.videoUrl ?? o.video_url;
  if (typeof direct === "string" && /^https?:\/\//i.test(direct)) return direct;

  const task = o.task as Record<string, unknown> | undefined;
  const content = task?.content as Record<string, unknown> | undefined;
  const url = content?.url;
  if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;

  return null;
}
