/**
 * Gateway 火山方舟 Seedream /images/generations（HTTP route 与 book-mall 进程内共用）。
 * 电商图层分离走进程内路径，避免再经公网域名自调用，被云托管约 60s 掐成 504。
 */

import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { parseUsageFromUnknown } from "@/lib/gateway/gateway-token-metrics";
import {
  logMetaToRequestLogFields,
  type GatewayV1LogMeta,
} from "@/lib/gateway/gateway-v1-log-meta";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import {
  createRequestLog,
  finalizeRequestLog,
  mapGatewayPreCreateLogError,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { resolveVolcengineModelKey } from "@/lib/gateway/volcengine-chat-models";
import {
  buildVolcengineImageLogResultSummary,
  parseSeedreamLayerDecomposeResponse,
  volcengineImageGenerations,
  type VolcengineImageGenerationsParams,
} from "@/lib/gateway/volcengine-image-generations-proxy";

const SEEDREAM_50_LITE = "doubao-seedream-5-0-260128";

export class GatewayV1VolcengineImageError extends Error {
  readonly status: number;
  readonly logId?: string;
  constructor(status: number, message: string, logId?: string) {
    super(message);
    this.name = "GatewayV1VolcengineImageError";
    this.status = status;
    this.logId = logId;
  }
}

export async function runGatewayV1VolcengineImageGenerations(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  body: {
    model?: string;
    prompt?: string;
    image?: string | string[];
    parameters?: VolcengineImageGenerationsParams;
  };
  logMeta?: GatewayV1LogMeta;
}): Promise<{
  images: Array<{ url?: string; b64?: string }>;
  layers?: Array<{
    url: string;
    zIndex: number;
    bbox?: { normalized?: number[]; absolute?: number[] };
    name?: string;
    isBackground: boolean;
  }>;
  usage?: unknown;
  logId: string;
}> {
  const requested = opts.body.model?.trim() || SEEDREAM_50_LITE;
  const model = resolveVolcengineModelKey(requested);
  const prompt = opts.body.prompt?.trim() ?? "";
  if (!prompt) {
    throw new GatewayV1VolcengineImageError(400, "prompt required");
  }

  routeGatewayModel(requested);

  const credentialId = pickCredentialForKind(opts.auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new GatewayV1VolcengineImageError(400, "No VOLCENGINE credential");
  }

  const clientSource = parseGatewayClientSource(opts.logMeta?.clientSource);
  const imageUrlsForLog = Array.isArray(opts.body.image)
    ? opts.body.image.filter((u) => typeof u === "string" && u.trim())
    : opts.body.image?.trim()
      ? [opts.body.image.trim()]
      : [];

  let log;
  try {
    log = await createRequestLog({
      userId: opts.auth.userId,
      apiKeyId: opts.auth.id,
      credentialId,
      model,
      endpoint: "/v1/volcengine/images/generations",
      providerKind: "VOLCENGINE",
      requestKind: "IMAGE",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, {
        prompt: prompt.slice(0, 200),
        referenceImageCount: imageUrlsForLog.length,
        ...(imageUrlsForLog.length ? { imageUrls: imageUrlsForLog } : {}),
        n: opts.body.parameters?.n ?? 1,
        size: opts.body.parameters?.size,
      }),
      ...logMetaToRequestLogFields(opts.logMeta ?? {}),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    throw new GatewayV1VolcengineImageError(mapped.status, mapped.error);
  }

  const started = Date.now();
  try {
    const cred = await getDecryptedCredentialApiKey(credentialId);
    if (!cred) {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: "Credential unavailable",
        model,
      });
      throw new GatewayV1VolcengineImageError(400, "Credential unavailable", log.id);
    }
    const result = await volcengineImageGenerations({
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl ?? undefined,
      model,
      prompt,
      image: opts.body.image,
      parameters: opts.body.parameters,
    });
    if (!result.ok) {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: result.error,
        model,
      });
      throw new GatewayV1VolcengineImageError(502, result.error, log.id);
    }
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: Date.now() - started,
      resultSummary: buildVolcengineImageLogResultSummary(result.raw, result.images),
      usage: parseUsageFromUnknown(result.raw),
      model,
    });
    const layers = parseSeedreamLayerDecomposeResponse(result.raw);
    return {
      images: result.images,
      usage: result.usage,
      ...(layers.length ? { layers } : {}),
      logId: log.id,
    };
  } catch (e) {
    if (e instanceof GatewayV1VolcengineImageError) throw e;
    const message = e instanceof Error ? e.message : "火山方舟图像生成失败";
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: message,
      model,
    });
    throw new GatewayV1VolcengineImageError(502, message, log.id);
  }
}
