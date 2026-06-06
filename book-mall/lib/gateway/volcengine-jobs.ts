import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { resolveVolcengineModelKey } from "@/lib/gateway/volcengine-chat-models";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
  volcengineCreateVideoTask,
  volcengineGetVideoTask,
  volcengineVideoTaskFailMessage,
} from "@/lib/gateway/volcengine-client";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
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

  const { taskId } = await volcengineCreateVideoTask({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    model: opts.model,
    body: payload,
  });

  const { prisma } = await import("@/lib/prisma");
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: taskId },
  });

  return taskId;
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
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    taskId: opts.taskId,
  });
  const row = polled.output;

  if (isVolcengineVideoTaskSuccess(row)) {
    const videoUrl = row.content?.video_url;
    await finalizeRequestLog(opts.logId, {
      status: "SUCCEEDED",
      durationMs: Date.now() - opts.startedAt,
      resultSummary: buildGatewayTaskResultSummary(
        polled.raw,
        videoUrl ? { videoUrl } : { status: row.status },
      ),
      externalTaskId: opts.taskId,
    });
    return "done";
  }

  if (isVolcengineVideoTaskFailed(row)) {
    await finalizeRequestLog(opts.logId, {
      status: "FAILED",
      durationMs: Date.now() - opts.startedAt,
      failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
      failCode: "VOLCENGINE_TASK_FAILED",
      externalTaskId: opts.taskId,
    });
    return "done";
  }

  return "pending";
}
