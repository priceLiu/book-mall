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
  finalizeRequestLog,
  parseOpenAiUsage,
  pickCredentialForKind,
  type UsageFromResponse,
} from "@/lib/gateway/proxy-common";
import {
  gatewayV1ChatCompletions,
  gatewayV1ChatCompletionsStream,
  gatewayV1ClientMeta,
  gatewayV1CreateTask,
  gatewayV1RecordInfo,
} from "@/lib/gateway/gateway-v1-http-client";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  buildGatewayChatResultSummary,
  buildGatewayStreamChatResultSummary,
  buildGatewayTaskResultSummary,
} from "@/lib/gateway/log-result-summary";
import type { DashscopeTaskOutput } from "@/lib/gateway/dashscope-client";

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
  routeGatewayModel(model);

  const body =
    opts.kind === "tryon"
      ? {
          model,
          dashscope: {
            jobKind: "tryon" as const,
            personImageUrl: opts.personImageUrl,
            topGarmentUrl: opts.topGarmentUrl,
            bottomGarmentUrl: opts.bottomGarmentUrl,
          },
        }
      : opts.kind === "wanx"
        ? {
            model,
            dashscope: {
              jobKind: "wanx" as const,
              prompt: opts.prompt,
              negativePrompt: opts.negativePrompt,
              n: opts.n,
            },
          }
        : {
            model,
            dashscope: {
              jobKind: "video" as const,
              videoBody: opts.body,
            },
          };

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body,
    meta: gatewayV1ClientMeta("TOOL", { clientPage: opts.clientPage }),
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: "DASHSCOPE",
  };
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

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta("TOOL"),
  });

  return polled.data as DashscopeTaskOutput;
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

  const result = await gatewayV1ChatCompletions({
    apiKeyId: auth.id,
    body,
    meta: gatewayV1ClientMeta("TOOL", { clientPage: opts.clientPage }),
  });
  let parsed: unknown = null;
  try {
    parsed = result.text ? JSON.parse(result.text) : null;
  } catch {
    parsed = null;
  }
  const usage = parseOpenAiUsage(parsed);
  const ok = result.status >= 200 && result.status < 300;
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
  return { text, rawPayload: parsed, logId: result.logId ?? "" };
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
              if (
                u.totalTokens != null ||
                u.promptTokens != null ||
                u.completionTokens != null
              ) {
                lastUsage = u;
              }
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
          resultSummary: lastUsage
            ? buildGatewayStreamChatResultSummary(lastUsage)
            : undefined,
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

  const result = await gatewayV1ChatCompletionsStream({
    apiKeyId: auth.id,
    body,
    meta: gatewayV1ClientMeta("TOOL", { clientPage: opts.clientPage }),
  });

  const logId = result.headers.get("x-gateway-log-id") ?? "";
  const bodyStream = result.body;

  if (!bodyStream || result.status >= 300) {
    const errText = bodyStream
      ? await new Response(bodyStream).text()
      : `HTTP ${result.status}`;
    throw new GatewayRequiredError(
      summarizeUpstreamFailMessage(errText, result.status),
      "UPSTREAM_ERROR",
      502,
    );
  }

  return {
    logId,
    status: result.status,
    body: wrapChatStreamWithLogFinalize(bodyStream, {
      logId,
      model,
      startedMs: 0,
    }),
  };
}
