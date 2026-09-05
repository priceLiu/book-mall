/**
 * Gateway chat/completions 核心逻辑（HTTP route 与 book-mall 进程内 Canvas 共用）。
 * Canvas 走进程内路径，避免 dev 下 mall → localhost HTTP 自调用在编译阻塞时 fetch failed。
 */
import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";
import {
  logMetaToRequestLogFields,
  type GatewayV1LogMeta,
} from "@/lib/gateway/gateway-v1-log-meta";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { buildGatewayChatResultSummary } from "@/lib/gateway/log-result-summary";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardChatCompletions,
  forwardChatCompletionsStream,
  mapGatewayPreCreateLogError,
  parseOpenAiUsage,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import {
  routeGatewayModel,
  UnknownGatewayModelError,
} from "@/lib/gateway/model-router";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import { wrapChatStreamWithLogFinalize } from "@/lib/gateway/gateway-chat-stream-finalize";

export class GatewayV1ChatError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GatewayV1ChatError";
    this.status = status;
  }
}

export async function runGatewayV1ChatCompletions(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  body: Record<string, unknown>;
  logMeta?: GatewayV1LogMeta;
  signal?: AbortSignal;
}): Promise<{ text: string; status: number; logId: string }> {
  const model = typeof opts.body.model === "string" ? opts.body.model : "";
  if (!model) {
    throw new GatewayV1ChatError(400, "model required");
  }

  let route;
  try {
    route = routeGatewayModel(model);
  } catch (e) {
    if (e instanceof UnknownGatewayModelError) {
      throw new GatewayV1ChatError(400, e.message);
    }
    throw e;
  }

  const credentialId = pickCredentialForKind(
    opts.auth.credentials,
    route.providerKind,
  );
  if (!credentialId) {
    throw new GatewayV1ChatError(
      400,
      `No ${route.providerKind} credential bound to this API key`,
    );
  }

  const clientSource = parseGatewayClientSource(opts.logMeta?.clientSource);
  const { model: _modelField, ...restBody } = opts.body;

  let log;
  try {
    log = await createRequestLog({
      userId: opts.auth.userId,
      apiKeyId: opts.auth.id,
      credentialId,
      model,
      endpoint: "/v1/chat/completions",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, restBody),
      ...logMetaToRequestLogFields(opts.logMeta ?? {}),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    throw new GatewayV1ChatError(mapped.status, mapped.error);
  }

  try {
    const result = await forwardChatCompletions({
      credentialId,
      providerKind: route.providerKind,
      body: opts.body,
      signal: opts.signal,
    });
    let parsed: unknown = null;
    try {
      parsed = result.text ? JSON.parse(result.text) : null;
    } catch {
      parsed = null;
    }
    const usage = parseOpenAiUsage(parsed);
    await finalizeRequestLog(log.id, {
      status: result.status >= 200 && result.status < 300 ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      usage,
      resultSummary: buildGatewayChatResultSummary(parsed) ?? undefined,
      failMessage: result.status >= 300 ? result.text.slice(0, 500) : undefined,
      model,
    });
    return { text: result.text, status: result.status, logId: log.id };
  } catch (e) {
    const aborted = opts.signal?.aborted === true;
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeRequestLog(log.id, {
      status: aborted ? "CANCELLED" : "FAILED",
      durationMs: Math.max(0, Date.now() - log.submittedAt.getTime()),
      failMessage: aborted ? "请求已取消" : msg.slice(0, 500),
      model,
    });
    throw new GatewayV1ChatError(aborted ? 499 : 502, aborted ? "请求已取消" : msg);
  }
}

/** 进程内流式 Chat（与 /api/gw/v1/chat/completions stream 一致，供电商拆解/拉片避免 HTTP 自调用卡死） */
export async function runGatewayV1ChatCompletionsStream(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  body: Record<string, unknown>;
  logMeta?: GatewayV1LogMeta;
}): Promise<{ status: number; logId: string; body: ReadableStream<Uint8Array> }> {
  const model = typeof opts.body.model === "string" ? opts.body.model : "";
  if (!model) {
    throw new GatewayV1ChatError(400, "model required");
  }

  let route;
  try {
    route = routeGatewayModel(model);
  } catch (e) {
    if (e instanceof UnknownGatewayModelError) {
      throw new GatewayV1ChatError(400, e.message);
    }
    throw e;
  }

  const credentialId = pickCredentialForKind(
    opts.auth.credentials,
    route.providerKind,
  );
  if (!credentialId) {
    throw new GatewayV1ChatError(
      400,
      `No ${route.providerKind} credential bound to this API key`,
    );
  }

  const clientSource = parseGatewayClientSource(opts.logMeta?.clientSource);
  const { model: _modelField, ...restBody } = opts.body;

  let log;
  try {
    log = await createRequestLog({
      userId: opts.auth.userId,
      apiKeyId: opts.auth.id,
      credentialId,
      model,
      endpoint: "/v1/chat/completions",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, restBody),
      ...logMetaToRequestLogFields(opts.logMeta ?? {}),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    throw new GatewayV1ChatError(mapped.status, mapped.error);
  }

  const startedAtMs = Date.now();
  let result: Awaited<ReturnType<typeof forwardChatCompletionsStream>>;
  try {
    result = await forwardChatCompletionsStream({
      credentialId,
      providerKind: route.providerKind,
      body: opts.body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - startedAtMs,
      failCode: "STREAM_UPSTREAM_ERROR",
      failMessage: msg.slice(0, 500),
      model,
    });
    throw new GatewayV1ChatError(502, msg);
  }

  if (!result.body || result.status >= 300) {
    const errText = result.body
      ? await new Response(result.body).text()
      : `HTTP ${result.status}`;
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failCode: `UPSTREAM_HTTP_${result.status}`,
      failMessage: errText.slice(0, 500),
      model,
    });
    throw new GatewayV1ChatError(result.status || 502, errText.slice(0, 500));
  }

  return {
    status: result.status,
    logId: log.id,
    body: wrapChatStreamWithLogFinalize(result.body, {
      logId: log.id,
      model,
      startedAtMs,
    }),
  };
}
