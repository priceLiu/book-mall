/**
 * 电商工具箱 → Gateway（支持 PLATFORM 代付 Key）
 */

import type { GatewayClientSource } from "@prisma/client";
import {
  GatewayRequiredError,
  summarizeUpstreamFailMessage,
} from "@/lib/gateway/book-gateway-link";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardChatCompletionsStream,
  parseOpenAiUsage,
  pickCredentialForKind,
  type UsageFromResponse,
} from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  pollBailianR2vTaskForLog,
  pollDashscopeTaskForLog,
  pollKieTaskForLog,
  submitBailianR2vJobForLog,
  submitDashscopeVideoJobForLog,
  submitDashscopeKlingV3ImageJobForLog,
  submitDashscopeWan27ImageJobForLog,
  submitDashscopeWanxJobForLog,
  submitKieJobForLog,
} from "@/lib/gateway/poll-service";
import {
  isBailianR2vFailed,
  isBailianR2vSucceeded,
} from "@/lib/canvas/canvas-gateway-client";
import {
  extractKieResultUrl,
  isKieRecordFail,
  isKieRecordSuccess,
} from "@/lib/story/kie-client";
import {
  dashscopeExtractTaskImageUrl,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import { submitVolcengineVideoJobForLog } from "@/lib/gateway/volcengine-jobs";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
} from "@/lib/gateway/volcengine-client";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import type { CanvasChatMessage } from "@/lib/canvas/providers/types";

const CLIENT_SOURCE: GatewayClientSource = "E_COMMERCE";

async function requireEcomGatewayAuth(bookUserId: string) {
  const auth = await resolveEcomGatewayAuthForUser(bookUserId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心完成 Gateway 配置");
  }
  if (auth.credentials.length === 0) {
    throw new GatewayRequiredError("Gateway API Key 未绑定厂商凭证");
  }
  return auth;
}

export async function ecomGwCreateDashscopeJob(
  bookUserId: string,
  opts:
    | {
        kind: "wanx";
        model: string;
        prompt: string;
        negativePrompt?: string;
        n: number;
        size?: string;
        refImg?: string;
        refMode?: "repaint" | "refonly";
        refStrength?: number;
        clientPage?: string;
      }
    | {
        kind: "wan27-image";
        model: string;
        content: Array<{ text: string } | { image: string }>;
        size?: string;
        n?: number;
        contentOrder?: "text-first" | "images-first";
        clientPage?: string;
      }
    | {
        kind: "kling-v3-image";
        model: string;
        content: Array<{ text: string } | { image: string }>;
        aspectRatio?: "16:9" | "9:16" | "1:1";
        resolution?: "1k" | "2k" | "4k";
        n?: number;
        clientPage?: string;
      }
    | {
        kind: "video";
        model: string;
        body: Record<string, unknown>;
        clientPage?: string;
      },
): Promise<{ taskId: string; logId: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 DashScope 凭证");
  }

  const model = opts.model.trim();
  const route = routeGatewayModel(model);
  const inputSummary =
    opts.kind === "wanx"
      ? buildGatewayInputSummary(model, { prompt: opts.prompt, n: opts.n })
      : opts.kind === "wan27-image" || opts.kind === "kling-v3-image"
        ? buildGatewayInputSummary(model, {
            refCount: opts.content.filter((c) => "image" in c).length,
            n: opts.n ?? 1,
          })
        : buildGatewayInputSummary(model, opts.body);

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "DASHSCOPE",
    requestKind: route.requestKind,
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary,
  });

  let taskId: string;
  if (opts.kind === "wanx") {
    taskId = await submitDashscopeWanxJobForLog({
      logId: log.id,
      credentialId,
      model,
      prompt: opts.prompt,
      negativePrompt: opts.negativePrompt,
      n: opts.n,
      size: opts.size,
      refImg: opts.refImg,
      refMode: opts.refMode,
      refStrength: opts.refStrength,
    });
  } else if (opts.kind === "wan27-image") {
    taskId = await submitDashscopeWan27ImageJobForLog({
      logId: log.id,
      credentialId,
      model,
      content: opts.content,
      size: opts.size,
      n: opts.n,
      contentOrder: opts.contentOrder,
    });
  } else if (opts.kind === "kling-v3-image") {
    taskId = await submitDashscopeKlingV3ImageJobForLog({
      logId: log.id,
      credentialId,
      model,
      content: opts.content,
      aspectRatio: opts.aspectRatio,
      resolution: opts.resolution,
      n: opts.n,
    });
  } else {
    taskId = await submitDashscopeVideoJobForLog({
      logId: log.id,
      credentialId,
      model,
      body: opts.body,
    });
  }

  return { taskId, logId: log.id };
}

export function ecomExtractMediaUrl(output: DashscopeTaskOutput): string | null {
  if (output.video_url?.trim()) return output.video_url.trim();
  const img = dashscopeExtractTaskImageUrl(output as Record<string, unknown>);
  return img ?? null;
}

export async function ecomGwPollDashscope(
  bookUserId: string,
  opts: { taskId: string; gatewayLogId: string },
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 DashScope 凭证");
  }

  const output = await pollDashscopeTaskForLog({
    credentialId,
    taskId: opts.taskId,
  });

  const status = output.task_status ?? "UNKNOWN";
  if (isDashscopeTaskSuccess(status)) {
    const outputUrl = ecomExtractMediaUrl(output);
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "SUCCEEDED",
      durationMs: 0,
      resultSummary: output,
      externalTaskId: opts.taskId,
    });
    return { status: "SUCCEEDED", outputUrl: outputUrl ?? undefined };
  }
  if (isDashscopeTaskFailed(status)) {
    const failMessage = output.message ?? output.code ?? "failed";
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "FAILED",
      durationMs: 0,
      failMessage: summarizeUpstreamFailMessage(failMessage, 500),
      externalTaskId: opts.taskId,
    });
    return { status: "FAILED", failMessage };
  }
  return { status };
}

function wrapEcomChatStreamWithLogFinalize(
  upstream: ReadableStream<Uint8Array>,
  ctx: { logId: string; model: string; startedMs: number },
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";
  let lastUsage: UsageFromResponse | undefined;
  let failMessage: string | undefined;

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as Record<string, unknown>;
              const u = parseOpenAiUsage(json);
              if (u.totalTokens != null) lastUsage = u;
              const err = json.error as { message?: string } | undefined;
              if (typeof err?.message === "string") failMessage = err.message;
            } catch {
              /* ignore */
            }
          }
        }
        await finalizeRequestLog(ctx.logId, {
          status: failMessage ? "FAILED" : "SUCCEEDED",
          durationMs: ctx.startedMs,
          usage: lastUsage,
          failCode: failMessage ? "STREAM_VENDOR_ERROR" : undefined,
          failMessage,
          model: ctx.model,
        });
        controller.close();
      } catch (e) {
        await finalizeRequestLog(ctx.logId, {
          status: "FAILED",
          durationMs: ctx.startedMs,
          failCode: "STREAM_INTERRUPTED",
          failMessage: (e as Error).message || "流式连接中断",
          model: ctx.model,
        });
        controller.error(e);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

/** 电商故事版 · Gateway 流式 Chat */
export async function ecomGwChatStream(
  bookUserId: string,
  opts: {
    modelKey: string;
    messages: CanvasChatMessage[];
    params?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ logId: string; status: number; body: ReadableStream<Uint8Array> }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const model = opts.modelKey.trim();
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new GatewayRequiredError(
      `Gateway Key 未绑定 ${route.providerKind} 凭证`,
    );
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
    ...(opts.params ?? {}),
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/chat/completions",
    providerKind: route.providerKind,
    requestKind: "CHAT",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(model, body),
  });

  const started = Date.now();
  const result = await forwardChatCompletionsStream({
    credentialId,
    providerKind: route.providerKind,
    body,
  });

  if (!result.body || result.status >= 300) {
    const errText = result.body
      ? await new Response(result.body).text()
      : `HTTP ${result.status}`;
    const failMessage = summarizeUpstreamFailMessage(errText, result.status);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failCode: `UPSTREAM_HTTP_${result.status}`,
      failMessage,
      model,
    });
    throw new GatewayRequiredError(failMessage);
  }

  return {
    logId: log.id,
    status: result.status,
    body: wrapEcomChatStreamWithLogFinalize(result.body, {
      logId: log.id,
      model,
      startedMs: Date.now() - started,
    }),
  };
}

export async function ecomGwCreateVolcengineVideoJob(
  bookUserId: string,
  opts: {
    model: string;
    body: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const route = routeGatewayModel(opts.model);
  if (route.providerKind !== "VOLCENGINE" || route.requestKind !== "VIDEO") {
    throw new GatewayRequiredError(`模型 ${opts.model} 非火山方舟视频`);
  }
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定火山方舟凭证");
  }

  const model = opts.model.trim();
  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "VOLCENGINE",
    requestKind: "VIDEO",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(model, opts.body),
  });

  const taskId = await submitVolcengineVideoJobForLog({
    logId: log.id,
    credentialId,
    model,
    body: opts.body,
  });

  return { taskId, logId: log.id };
}

export async function ecomGwPollVolcengine(
  bookUserId: string,
  opts: { taskId: string; gatewayLogId: string },
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定火山方舟凭证");
  }

  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) {
    throw new GatewayRequiredError("火山方舟凭证不可用");
  }

  const row = await volcengineGetVideoTask({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    taskId: opts.taskId,
  });

  if (isVolcengineVideoTaskSuccess(row)) {
    const outputUrl = row.content?.video_url?.trim();
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "SUCCEEDED",
      durationMs: 0,
      resultSummary: outputUrl ? { videoUrl: outputUrl } : { status: row.status },
      externalTaskId: opts.taskId,
    });
    return { status: "SUCCEEDED", outputUrl: outputUrl ?? undefined };
  }

  if (isVolcengineVideoTaskFailed(row)) {
    const failMessage =
      typeof row.error === "string"
        ? row.error
        : (row.error?.message ?? `status=${row.status}`);
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "FAILED",
      durationMs: 0,
      failMessage: summarizeUpstreamFailMessage(failMessage, 500),
      externalTaskId: opts.taskId,
    });
    return { status: "FAILED", failMessage };
  }

  return { status: row.status ?? "PENDING" };
}

export async function ecomGwCreateKieJob(
  bookUserId: string,
  opts: {
    model: string;
    input: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const route = routeGatewayModel(opts.model);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 KIE 凭证");
  }

  const model = opts.model.trim();
  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "KIE",
    requestKind: route.requestKind,
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(model, opts.input),
  });

  const taskId = await submitKieJobForLog({
    logId: log.id,
    credentialId,
    model,
    input: opts.input,
    callBackUrl: null,
  });

  return { taskId, logId: log.id };
}

export async function ecomGwPollKie(
  bookUserId: string,
  opts: { taskId: string; gatewayLogId: string },
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 KIE 凭证");
  }

  const record = await pollKieTaskForLog({
    logId: opts.gatewayLogId,
    credentialId,
    taskId: opts.taskId,
  });

  const state = record.state ?? "UNKNOWN";
  if (isKieRecordSuccess(state)) {
    const outputUrl = extractKieResultUrl(record) ?? undefined;
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "SUCCEEDED",
      durationMs: 0,
      resultSummary: { state, resultJson: record.resultJson },
      externalTaskId: record.taskId,
      model: record.model,
    });
    return { status: "SUCCEEDED", outputUrl };
  }
  if (isKieRecordFail(state)) {
    const failMessage = record.failMsg ?? record.failCode ?? "failed";
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "FAILED",
      durationMs: 0,
      failMessage: summarizeUpstreamFailMessage(failMessage, 500),
      externalTaskId: record.taskId,
      model: record.model,
    });
    return { status: "FAILED", failMessage };
  }
  return { status: state };
}

export async function ecomGwCreateBailianR2vJob(
  bookUserId: string,
  opts: {
    model: string;
    prompt: string;
    referenceImageUrls: string[];
    resolution: "720P" | "1080P";
    ratio: string;
    duration: number;
    seedStr?: string;
    parameterExtras?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼凭证");
  }

  const model = opts.model.trim();
  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "BAILIAN",
    requestKind: "VIDEO",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(model, {
      prompt: opts.prompt,
      referenceImageUrls: opts.referenceImageUrls,
      resolution: opts.resolution,
      ratio: opts.ratio,
      duration: opts.duration,
      ...(opts.seedStr ? { seed: opts.seedStr } : {}),
      ...(opts.parameterExtras ?? {}),
    }),
  });

  const taskId = await submitBailianR2vJobForLog({
    logId: log.id,
    credentialId,
    model,
    prompt: opts.prompt,
    referenceImageUrls: opts.referenceImageUrls,
    resolution: opts.resolution,
    ratio: opts.ratio,
    duration: opts.duration,
    seedStr: opts.seedStr,
    parameterExtras: opts.parameterExtras,
  });

  return { taskId, logId: log.id };
}

export async function ecomGwPollBailianR2v(
  bookUserId: string,
  opts: { taskId: string; gatewayLogId: string },
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼凭证");
  }

  const output = await pollBailianR2vTaskForLog({
    credentialId,
    taskId: opts.taskId,
  });

  if (isBailianR2vSucceeded(output)) {
    const outputUrl = output.video_url?.trim() ?? undefined;
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "SUCCEEDED",
      durationMs: 0,
      resultSummary: outputUrl ? { videoUrl: outputUrl } : { status: output.task_status },
      externalTaskId: opts.taskId,
    });
    return { status: "SUCCEEDED", outputUrl };
  }

  if (isBailianR2vFailed(output)) {
    const failMessage =
      output.message ?? output.code ?? `status=${output.task_status ?? "FAILED"}`;
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "FAILED",
      durationMs: 0,
      failMessage: summarizeUpstreamFailMessage(failMessage, 500),
      externalTaskId: opts.taskId,
    });
    return { status: "FAILED", failMessage };
  }

  return { status: output.task_status ?? "PENDING" };
}
