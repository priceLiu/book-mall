import type { GatewayClientSource, GatewayProviderKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDecryptedCredentialApiKey } from "./credential-service";
import { pickCredentialIdForProvider } from "./gateway-credential-match";
import {
  defaultBaseUrl,
  resolveBailianChatModelKey,
  resolveKieGeminiChatPath,
  resolveOpenAiCompatibleBaseUrl,
  resolveVolcengineModelKey,
  routeGatewayModel,
} from "./model-router";
import { forwardQwenTtsSpeech, isQwenTtsModel } from "./qwen-tts-proxy";
import {
  parseUsageFromUnknown,
  resolveGatewayTokenMetrics,
  type UsageFromResponse,
} from "./gateway-token-metrics";
import { parseVideoPricingHints } from "./log-pricing-hints";
import { estimateVendorCost } from "./pricing-estimate";

export type { UsageFromResponse };

/** 从厂商 JSON 解析 usage（含 prompt_tokens / input_tokens 等别名） */
export function parseOpenAiUsage(json: unknown): UsageFromResponse {
  return parseUsageFromUnknown(json);
}

export function pickCredentialForKind(
  credentials: { id: string; providerKind: GatewayProviderKind }[],
  kind: GatewayProviderKind,
): string | null {
  return pickCredentialIdForProvider(credentials, kind);
}

export async function createRequestLog(opts: {
  userId: string;
  apiKeyId: string;
  credentialId?: string | null;
  model: string;
  endpoint: string;
  providerKind?: GatewayProviderKind;
  requestKind?: "CHAT" | "IMAGE" | "VIDEO" | "OTHER" | "TTS" | "TRYON";
  clientSource?: GatewayClientSource;
  clientPage?: string | null;
  inputSummary?: unknown;
  storyProjectId?: string | null;
  storyTaskId?: string | null;
}) {
  const route = routeGatewayModel(opts.model);
  return prisma.gatewayRequestLog.create({
    data: {
      userId: opts.userId,
      apiKeyId: opts.apiKeyId,
      credentialId: opts.credentialId ?? undefined,
      model: opts.model,
      endpoint: opts.endpoint,
      providerKind: opts.providerKind ?? route.providerKind,
      requestKind: opts.requestKind ?? route.requestKind,
      status: "RUNNING",
      clientSource: opts.clientSource ?? "EXTERNAL",
      clientPage: opts.clientPage ?? undefined,
      inputSummary: opts.inputSummary ?? undefined,
      storyProjectId: opts.storyProjectId ?? undefined,
      storyTaskId: opts.storyTaskId ?? undefined,
      submittedAt: new Date(),
    },
  });
}

export async function finalizeRequestLog(
  logId: string,
  patch: {
    status: "SUCCEEDED" | "FAILED";
    durationMs: number;
    usage?: UsageFromResponse;
    vendorDurationMs?: number;
    resultSummary?: unknown;
    failMessage?: string;
    failCode?: string;
    externalTaskId?: string;
    model?: string;
    pricingTierRaw?: string;
  },
) {
  const log = await prisma.gatewayRequestLog.findUnique({ where: { id: logId } });
  if (!log) return;

  let durationMs = patch.durationMs;
  if (durationMs <= 0 && log.submittedAt) {
    durationMs = Math.max(0, Date.now() - log.submittedAt.getTime());
  }

  const tokenMetrics = resolveGatewayTokenMetrics({
    usage: patch.usage,
    inputSummary: log.inputSummary,
    resultSummary: patch.resultSummary,
    requestKind: log.requestKind,
  });

  const videoHints =
    log.requestKind === "VIDEO"
      ? parseVideoPricingHints(log.inputSummary)
      : {};

  const estimate = await estimateVendorCost({
    modelKey: patch.model ?? log.model,
    promptTokens: tokenMetrics.promptTokens ?? undefined,
    completionTokens: tokenMetrics.completionTokens ?? undefined,
    tierRaw: patch.pricingTierRaw ?? videoHints.tierRaw,
    durationSec: videoHints.durationSec,
    requestKind: log.requestKind,
  });

  await prisma.gatewayRequestLog.update({
    where: { id: logId },
    data: {
      status: patch.status,
      durationMs,
      vendorDurationMs: patch.vendorDurationMs,
      promptTokens: tokenMetrics.promptTokens,
      completionTokens: tokenMetrics.completionTokens,
      totalTokens: tokenMetrics.totalTokens,
      hasTokenUsage: tokenMetrics.hasTokenUsage,
      metricsSource: tokenMetrics.metricsSource,
      resultSummary: patch.resultSummary ?? undefined,
      failMessage: patch.failMessage,
      failCode: patch.failCode,
      externalTaskId: patch.externalTaskId,
      completedAt: new Date(),
      pricingModelKey: estimate.pricingModelKey,
      pricingTierRaw: estimate.pricingTierRaw,
      billingKind: estimate.billingKind,
      vendorListUnitCostYuan: estimate.vendorListUnitCostYuan,
      estimatedVendorCostYuan: estimate.estimatedVendorCostYuan,
    },
  });
}

export async function forwardChatCompletions(opts: {
  credentialId: string;
  providerKind: GatewayProviderKind;
  body: Record<string, unknown>;
  baseUrlOverride?: string | null;
}): Promise<{ status: number; text: string; durationMs: number }> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");

  const base = resolveOpenAiCompatibleBaseUrl(
    cred.providerKind,
    opts.baseUrlOverride || cred.baseUrl,
  );
  let url = `${base}/chat/completions`;

  if (cred.providerKind === "KIE") {
    const modelKey =
      typeof opts.body.model === "string" ? opts.body.model : "gemini-3-flash";
    url = `${base}/${resolveKieGeminiChatPath(modelKey)}/v1/chat/completions`;
  }

  const requestBody =
    cred.providerKind === "BAILIAN" && typeof opts.body.model === "string"
      ? {
          ...opts.body,
          model: resolveBailianChatModelKey(opts.body.model),
        }
      : cred.providerKind === "VOLCENGINE" && typeof opts.body.model === "string"
        ? {
            ...opts.body,
            model: resolveVolcengineModelKey(opts.body.model),
          }
        : opts.body;

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  const text = await r.text();
  return { status: r.status, text, durationMs: Date.now() - started };
}

export async function forwardChatCompletionsStream(opts: {
  credentialId: string;
  providerKind: GatewayProviderKind;
  body: Record<string, unknown>;
  baseUrlOverride?: string | null;
}): Promise<{ status: number; body: ReadableStream<Uint8Array> | null; durationMs: number }> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");

  const base = resolveOpenAiCompatibleBaseUrl(
    cred.providerKind,
    opts.baseUrlOverride || cred.baseUrl,
  );
  let url = `${base}/chat/completions`;

  if (cred.providerKind === "KIE") {
    const modelKey =
      typeof opts.body.model === "string" ? opts.body.model : "gemini-3-flash";
    url = `${base}/${resolveKieGeminiChatPath(modelKey)}/v1/chat/completions`;
  }

  const requestBody =
    cred.providerKind === "BAILIAN" && typeof opts.body.model === "string"
      ? {
          ...opts.body,
          model: resolveBailianChatModelKey(opts.body.model),
        }
      : cred.providerKind === "VOLCENGINE" && typeof opts.body.model === "string"
        ? {
            ...opts.body,
            model: resolveVolcengineModelKey(opts.body.model),
          }
        : opts.body;

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify({ ...requestBody, stream: true }),
  });
  return {
    status: r.status,
    body: r.body,
    durationMs: Date.now() - started,
  };
}

export async function forwardAudioSpeech(opts: {
  credentialId: string;
  providerKind: GatewayProviderKind;
  body: Record<string, unknown>;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  buffer: Buffer;
  durationMs: number;
  contentType?: string;
  ext?: string;
  vendorJson?: unknown;
}> {
  const model = String(opts.body.model ?? "").trim();
  if (isQwenTtsModel(model)) {
    return forwardQwenTtsSpeech(opts);
  }

  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");

  const base = resolveOpenAiCompatibleBaseUrl(
    cred.providerKind === "DASHSCOPE" ? "BAILIAN" : cred.providerKind,
    opts.baseUrlOverride || cred.baseUrl,
  );
  const url = `${base}/audio/speech`;

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify(opts.body),
  });
  const buffer = Buffer.from(await r.arrayBuffer());
  return { status: r.status, buffer, durationMs: Date.now() - started };
}
