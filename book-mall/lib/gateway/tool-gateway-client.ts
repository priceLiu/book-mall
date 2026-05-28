/**
 * 工具站 → Gateway 内部客户端（试衣 / 文生图 / 视频实验室 / 分析室）
 */

import type { GatewayClientSource, GatewayProviderKind } from "@prisma/client";

import {
  assertGatewayApiKeyLinkedForUser,
  GatewayRequiredError,
  resolveGatewayAuthForBookUser,
  summarizeUpstreamFailMessage,
} from "@/lib/gateway/book-gateway-link";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardChatCompletions,
  forwardChatCompletionsStream,
  parseOpenAiUsage,
  pickCredentialForKind,
  type UsageFromResponse,
} from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { buildGatewayChatResultSummary } from "@/lib/gateway/log-result-summary";
import {
  pollDashscopeTaskForLog,
  submitDashscopeTryOnJobForLog,
  submitDashscopeVideoJobForLog,
  submitDashscopeWanxJobForLog,
} from "@/lib/gateway/poll-service";
import {
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";

const CLIENT_SOURCE: GatewayClientSource = "TOOL";

async function requireGatewayAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  if (auth.credentials.length === 0) {
    throw new GatewayRequiredError("Gateway API Key 未绑定厂商凭证");
  }
  return auth;
}

export async function toolGwCreateDashscopeJob(
  userId: string,
  opts: (
    | {
        kind: "tryon";
        model: string;
        personImageUrl: string;
        topGarmentUrl?: string;
        bottomGarmentUrl?: string;
        clientPage?: string;
      }
    | {
        kind: "wanx";
        model: string;
        prompt: string;
        negativePrompt?: string;
        n: number;
        clientPage?: string;
      }
    | {
        kind: "video";
        model: string;
        body: Record<string, unknown>;
        clientPage?: string;
      }
  ),
): Promise<{ taskId: string; logId: string; providerKind: GatewayProviderKind }> {
  const auth = await requireGatewayAuth(userId);
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 DashScope 凭证");
  }

  const model = opts.model.trim();
  const route = routeGatewayModel(model);
  const inputSummary =
    opts.kind === "tryon"
      ? buildGatewayInputSummary(model, {
          personImageUrl: opts.personImageUrl,
          topGarmentUrl: opts.topGarmentUrl,
          bottomGarmentUrl: opts.bottomGarmentUrl,
        })
      : opts.kind === "wanx"
        ? buildGatewayInputSummary(model, {
            prompt: opts.prompt,
            n: opts.n,
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
  if (opts.kind === "tryon") {
    taskId = await submitDashscopeTryOnJobForLog({
      logId: log.id,
      credentialId,
      model,
      personImageUrl: opts.personImageUrl,
      topGarmentUrl: opts.topGarmentUrl,
      bottomGarmentUrl: opts.bottomGarmentUrl,
    });
  } else if (opts.kind === "wanx") {
    taskId = await submitDashscopeWanxJobForLog({
      logId: log.id,
      credentialId,
      model,
      prompt: opts.prompt,
      negativePrompt: opts.negativePrompt,
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

  return { taskId, logId: log.id, providerKind: "DASHSCOPE" };
}

export async function toolGwPollDashscope(
  userId: string,
  opts: { taskId: string; gatewayLogId?: string | null },
): Promise<DashscopeTaskOutput> {
  const auth = await requireGatewayAuth(userId);
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 DashScope 凭证");
  }

  const output = await pollDashscopeTaskForLog({
    credentialId,
    taskId: opts.taskId,
  });

  if (opts.gatewayLogId) {
    const status = output.task_status;
    if (isDashscopeTaskSuccess(status)) {
      await finalizeRequestLog(opts.gatewayLogId, {
        status: "SUCCEEDED",
        durationMs: 0,
        resultSummary: output,
        externalTaskId: opts.taskId,
      });
    } else if (isDashscopeTaskFailed(status)) {
      await finalizeRequestLog(opts.gatewayLogId, {
        status: "FAILED",
        durationMs: 0,
        failMessage: output.message ?? output.code ?? "failed",
        externalTaskId: opts.taskId,
      });
    }
  }

  return output;
}

export async function toolGwChat(
  userId: string,
  opts: {
    modelKey: string;
    messages: { role: string; content: unknown }[];
    params?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ text: string; rawPayload: unknown; logId: string }> {
  const auth = await requireGatewayAuth(userId);
  const model = opts.modelKey.trim();
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new GatewayRequiredError(`Gateway Key 未绑定 ${route.providerKind} 凭证`);
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: false,
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

  const result = await forwardChatCompletions({
    credentialId,
    providerKind: route.providerKind,
    body,
  });
  let parsed: unknown = null;
  try {
    parsed = result.text ? JSON.parse(result.text) : null;
  } catch {
    parsed = null;
  }
  const usage = parseOpenAiUsage(parsed);
  const ok = result.status >= 200 && result.status < 300;
  await finalizeRequestLog(log.id, {
    status: ok ? "SUCCEEDED" : "FAILED",
    durationMs: result.durationMs,
    usage,
    resultSummary: buildGatewayChatResultSummary(parsed) ?? undefined,
    failCode: ok ? undefined : `UPSTREAM_HTTP_${result.status}`,
    failMessage: ok
      ? undefined
      : summarizeUpstreamFailMessage(result.text, result.status),
    model,
  });
  if (!ok) {
    throw new GatewayRequiredError(
      summarizeUpstreamFailMessage(result.text, result.status),
      "UPSTREAM_ERROR",
      502,
    );
  }
  const choice = (parsed as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0];
  const text =
    typeof choice?.message?.content === "string"
      ? choice.message.content
      : result.text;
  return { text, rawPayload: parsed, logId: log.id };
}

function wrapChatStreamWithLogFinalize(
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
              /* ignore partial JSON */
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

export async function toolGwChatStream(
  userId: string,
  opts: {
    modelKey: string;
    messages: { role: string; content: unknown }[];
    params?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ logId: string; status: number; body: ReadableStream<Uint8Array> }> {
  const auth = await requireGatewayAuth(userId);
  const model = opts.modelKey.trim();
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new GatewayRequiredError(`Gateway Key 未绑定 ${route.providerKind} 凭证`);
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
      durationMs: result.durationMs,
      failCode: `UPSTREAM_HTTP_${result.status}`,
      failMessage,
      model,
    });
    throw new GatewayRequiredError(
      summarizeUpstreamFailMessage(errText, result.status),
      "UPSTREAM_ERROR",
      502,
    );
  }

  return {
    logId: log.id,
    status: result.status,
    body: wrapChatStreamWithLogFinalize(result.body, {
      logId: log.id,
      model,
      startedMs: result.durationMs,
    }),
  };
}
