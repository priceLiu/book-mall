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
  mapGatewayPreCreateLogError,
  parseOpenAiUsage,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import {
  routeGatewayModel,
  UnknownGatewayModelError,
} from "@/lib/gateway/model-router";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";

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
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failMessage: msg.slice(0, 500),
      model,
    });
    throw new GatewayV1ChatError(502, msg);
  }
}
