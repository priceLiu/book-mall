import type { GatewayClientSource, GatewayProviderKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDecryptedCredentialApiKey } from "./credential-service";
import { defaultBaseUrl, routeGatewayModel } from "./model-router";
import { estimateVendorCost } from "./pricing-estimate";

export type UsageFromResponse = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export function parseOpenAiUsage(json: unknown): UsageFromResponse {
  const u = (json as { usage?: Record<string, unknown> })?.usage;
  if (!u) return {};
  return {
    promptTokens:
      typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined,
    completionTokens:
      typeof u.completion_tokens === "number" ? u.completion_tokens : undefined,
    totalTokens: typeof u.total_tokens === "number" ? u.total_tokens : undefined,
  };
}

export function pickCredentialForKind(
  credentials: { id: string; providerKind: GatewayProviderKind }[],
  kind: GatewayProviderKind,
): string | null {
  const hit = credentials.find((c) => c.providerKind === kind);
  return hit?.id ?? credentials[0]?.id ?? null;
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
    externalTaskId?: string;
    model?: string;
    pricingTierRaw?: string;
  },
) {
  const hasToken =
    patch.usage?.totalTokens != null ||
    patch.usage?.promptTokens != null ||
    patch.usage?.completionTokens != null;

  const log = await prisma.gatewayRequestLog.findUnique({ where: { id: logId } });
  if (!log) return;

  const estimate = await estimateVendorCost({
    modelKey: patch.model ?? log.model,
    promptTokens: patch.usage?.promptTokens,
    completionTokens: patch.usage?.completionTokens,
    tierRaw: patch.pricingTierRaw,
    requestKind: log.requestKind,
  });

  await prisma.gatewayRequestLog.update({
    where: { id: logId },
    data: {
      status: patch.status,
      durationMs: patch.durationMs,
      vendorDurationMs: patch.vendorDurationMs,
      promptTokens: patch.usage?.promptTokens ?? null,
      completionTokens: patch.usage?.completionTokens ?? null,
      totalTokens: patch.usage?.totalTokens ?? null,
      hasTokenUsage: hasToken,
      metricsSource: hasToken ? "VENDOR" : "UNAVAILABLE",
      resultSummary: patch.resultSummary ?? undefined,
      failMessage: patch.failMessage,
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

  const base = opts.baseUrlOverride || cred.baseUrl || defaultBaseUrl(cred.providerKind);
  let url = `${base.replace(/\/$/, "")}/chat/completions`;

  if (cred.providerKind === "KIE") {
    url = `${base.replace(/\/$/, "")}/gemini-3-flash/v1/chat/completions`;
  }

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify(opts.body),
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

  const base = opts.baseUrlOverride || cred.baseUrl || defaultBaseUrl(cred.providerKind);
  let url = `${base.replace(/\/$/, "")}/chat/completions`;

  if (cred.providerKind === "KIE") {
    url = `${base.replace(/\/$/, "")}/gemini-3-flash/v1/chat/completions`;
  }

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify({ ...opts.body, stream: true }),
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
}): Promise<{ status: number; buffer: Buffer; durationMs: number }> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");

  const base =
    opts.baseUrlOverride ||
    cred.baseUrl ||
    defaultBaseUrl(cred.providerKind === "DASHSCOPE" ? "BAILIAN" : cred.providerKind);
  const url = `${base.replace(/\/$/, "")}/audio/speech`;

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
