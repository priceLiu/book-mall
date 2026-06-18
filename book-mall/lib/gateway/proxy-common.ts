import type { GatewayClientSource, GatewayProviderKind, BillingPersona } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDecryptedCredentialApiKey } from "./credential-service";
import {
  pickCredentialIdForProvider,
  type RoutableCredential,
} from "./gateway-credential-match";
import {
  defaultBaseUrl,
  resolveBailianChatModelKey,
  resolveDeepseekChatModelKey,
  resolveKieGeminiChatPath,
  resolveOpenAiCompatibleBaseUrl,
  resolveVolcengineModelKey,
  routeGatewayModel,
} from "./model-router";
import { forwardQwenTtsSpeech, isQwenTtsModel } from "./qwen-tts-proxy";
import { resolveVolcengineArkApiKey } from "./volcengine-gateway-credential";
import {
  parseUsageFromUnknown,
  resolveGatewayTokenMetrics,
  type UsageFromResponse,
} from "./gateway-token-metrics";
import { assertModelRegistered, UnregisteredGatewayModelError } from "./model-registry";
import { resolveBillableImageCountFromLog } from "./log-billing-metrics";
import { parseVideoPricingHints } from "./log-pricing-hints";
import { estimateVendorCost } from "./pricing-estimate";
import {
  resolveBillingCanonicalKey,
  resolveCostSnapshot,
  type CostSnapshot,
} from "./credit-billing-guard";
import {
  refundFailedGatewayLog,
  reserveVideoCreditsForLog,
  settleSucceededGatewayLog,
} from "@/lib/billing/gateway-credit-settlement";
import { assertCreditsBeforeGenerate } from "@/lib/billing/credit-pre-check";
import { InsufficientCreditsError } from "@/lib/billing/credit-account-service";
import { ByokSubscriptionRequiredError } from "@/lib/billing/byok-subscription-service";
import {
  guardVideoGenerate,
  releaseVideoGenerate,
  resolveVideoRiskContext,
} from "@/lib/billing/video-risk-control";
import { assertByokQuotaBeforeGenerate } from "@/lib/billing/byok-overage-service";
import { resolveGatewayLogBillingMode } from "@/lib/billing/gateway-billing-mode";
import {
  isStaffRole,
} from "@/lib/billing/billing-persona";
import {
  acquireTenantSlot,
  releaseTenantSlot,
  isConcurrencyEnabled,
} from "@/lib/redis-service";

export type { UsageFromResponse };

/** 租户并发超限（里程碑 7，仅在配置 REDIS_URL 时触发）。 */
export class ConcurrencyLimitError extends Error {
  constructor(public readonly max: number) {
    super(`并发任务已达上限（${max}），请稍后再试`);
    this.name = "ConcurrencyLimitError";
  }
}

/** createRequestLog 预检失败 → HTTP 状态与可读文案（避免 route 未捕获时变成裸 500）。 */
export function mapGatewayPreCreateLogError(e: unknown): { status: number; error: string } {
  if (e instanceof UnregisteredGatewayModelError) {
    return { status: 400, error: e.message };
  }
  if (e instanceof InsufficientCreditsError) {
    return { status: 402, error: e.message };
  }
  if (e instanceof ByokSubscriptionRequiredError) {
    return { status: 403, error: e.message };
  }
  if (e instanceof ConcurrencyLimitError) {
    return { status: 429, error: e.message };
  }
  if (e instanceof Error && e.message.trim()) {
    return { status: 500, error: e.message };
  }
  return { status: 500, error: "Gateway 预检失败" };
}

/** 从厂商 JSON 解析 usage（含 prompt_tokens / input_tokens 等别名） */
export function parseOpenAiUsage(json: unknown): UsageFromResponse {
  return parseUsageFromUnknown(json);
}

export function pickCredentialForKind(
  credentials: RoutableCredential[],
  kind: GatewayProviderKind,
  preferredCredentialId?: string | null,
): string | null {
  return pickCredentialIdForProvider(credentials, kind, preferredCredentialId);
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
  /** 多租户：计费归属租户（团队空间生成时传入） */
  tenantId?: string | null;
  /** 多租户：实际操作的 Book 用户（团队下区分成员） */
  actorBookUserId?: string | null;
  /** 多租户：占用席位 */
  seatId?: string | null;
  staffFlag?: boolean;
  billingPersonaSnap?: BillingPersona | null;
}) {
  await assertModelRegistered(opts.model).catch((e) => {
    if (e instanceof UnregisteredGatewayModelError) throw e;
    throw e;
  });

  const route = routeGatewayModel(opts.model);

  let staffFlag = opts.staffFlag ?? false;
  let billingPersonaSnap = opts.billingPersonaSnap ?? null;
  if (opts.actorBookUserId) {
    const actor = await prisma.user.findUnique({
      where: { id: opts.actorBookUserId },
      select: { role: true, billingPersona: true, billingPersonaLockedAt: true },
    });
    if (actor) {
      staffFlag = isStaffRole(actor.role);
      if (actor.billingPersonaLockedAt) {
        billingPersonaSnap = actor.billingPersona;
      }
    }
  } else if (opts.staffFlag == null) {
    staffFlag = false;
  }

  const billingMode = await resolveGatewayLogBillingMode({
    tenantId: opts.tenantId,
    credentialId: opts.credentialId,
    actorBookUserId: opts.actorBookUserId,
  });

  const isVideoReq = (opts.requestKind ?? route.requestKind) === "VIDEO";
  let riskAccountId: string | null = null;
  let riskPopup: string | undefined;

  // 团队共享积分池：余额不足则拒绝发起（用完即停）
  if (billingMode === "PLATFORM_CREDIT") {
    await assertCreditsBeforeGenerate({
      tenantId: opts.tenantId,
      actorBookUserId: opts.actorBookUserId,
      apiKeyId: opts.apiKeyId,
      model: opts.model,
      requestKind: opts.requestKind ?? route.requestKind,
      inputSummary: opts.inputSummary,
    });
    // 视频专项风控（并发/队列/单日/批量/冷却/异常阶梯）
    if (isVideoReq) {
      const g = await guardVideoGenerate({
        tenantId: opts.tenantId,
        actorBookUserId: opts.actorBookUserId,
        apiKeyId: opts.apiKeyId,
        batchCount: 1,
      });
      riskAccountId = g.accountId;
      riskPopup = g.riskPopup;
    }
  } else if (billingMode === "BYOK") {
    await assertByokQuotaBeforeGenerate({
      tenantId: opts.tenantId,
      actorBookUserId: opts.actorBookUserId,
      apiKeyId: opts.apiKeyId,
      requestKind: opts.requestKind ?? route.requestKind,
      inputSummary: opts.inputSummary,
    });
  }
  if (isConcurrencyEnabled() && opts.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: opts.tenantId },
      select: { maxConcurrency: true },
    });
    const max = tenant?.maxConcurrency ?? 0;
    const slot = await acquireTenantSlot({ tenantId: opts.tenantId, max });
    if (!slot.ok) throw new ConcurrencyLimitError(slot.max ?? max);
  }

  const log = await prisma.gatewayRequestLog.create({
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
      inputSummary:
        riskPopup != null
          ? {
              ...(opts.inputSummary && typeof opts.inputSummary === "object" && !Array.isArray(opts.inputSummary)
                ? (opts.inputSummary as Record<string, unknown>)
                : {}),
              videoRiskPopup: riskPopup,
            }
          : (opts.inputSummary ?? undefined),
      storyProjectId: opts.storyProjectId ?? undefined,
      storyTaskId: opts.storyTaskId ?? undefined,
      tenantId: opts.tenantId ?? undefined,
      actorBookUserId: opts.actorBookUserId ?? undefined,
      seatId: opts.seatId ?? undefined,
      billingMode,
      staffFlag,
      billingPersonaSnap: billingPersonaSnap ?? undefined,
      submittedAt: new Date(),
    },
  });

  // 视频「先冻结后渲染」：发起前冻结预扣；余额不足回滚并阻断（释放并发槽与风控占用）
  if (billingMode === "PLATFORM_CREDIT" && log.requestKind === "VIDEO") {
    try {
      await reserveVideoCreditsForLog(log);
    } catch (e) {
      if (isConcurrencyEnabled() && opts.tenantId) {
        await releaseTenantSlot(opts.tenantId).catch(() => undefined);
      }
      await releaseVideoGenerate(riskAccountId).catch(() => undefined);
      await prisma.gatewayRequestLog
        .update({
          where: { id: log.id },
          data: { status: "FAILED", failCode: "INSUFFICIENT_CREDITS", failMessage: (e as Error).message, completedAt: new Date() },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  return log;
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
    vendorRequestId?: string;
    model?: string;
    pricingTierRaw?: string;
  },
) {
  const log = await prisma.gatewayRequestLog.findUnique({ where: { id: logId } });
  if (!log) return;

  // 租户并发限流：任务结束释放占用（仅配置 REDIS_URL 时生效）
  if (isConcurrencyEnabled() && log.tenantId) {
    try {
      await releaseTenantSlot(log.tenantId);
    } catch {
      // 释放失败不影响结算（有 TTL 兜底）
    }
  }

  // 视频专项风控：任务结束释放并发与队列计数
  if (isConcurrencyEnabled() && log.requestKind === "VIDEO") {
    try {
      const ctx = await resolveVideoRiskContext({
        tenantId: log.tenantId,
        actorBookUserId: log.actorBookUserId,
        apiKeyId: log.apiKeyId,
      });
      await releaseVideoGenerate(ctx?.accountId ?? null);
    } catch {
      // 释放失败不影响结算（有 TTL 兜底）
    }
  }

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

  // 统一积分计费 — 成本快照审计（绑错 key 可追溯，不阻断主流程）
  let canonicalModelKey: string | null = log.canonicalModelKey ?? null;
  let costSnapshotYuan: number | null = null;
  let marginSnapshot: number | null = null;
  let costSnapshot: CostSnapshot | null = null;
  try {
    if (!canonicalModelKey) {
      canonicalModelKey = await resolveBillingCanonicalKey({
        modelKey: patch.model ?? log.model,
        inputSummary: log.inputSummary,
      });
    }
    if (canonicalModelKey) {
      costSnapshot = await resolveCostSnapshot(canonicalModelKey);
      if (costSnapshot) {
        costSnapshotYuan = costSnapshot.netCostYuan;
        marginSnapshot = costSnapshot.marginRate;
      }
    }
  } catch {
    // 快照失败不影响日志落库
  }

  // 多 Key 对账 — 凭证别名/渠道快照（绑定时记录，便于按渠道对账）
  let credentialAliasSnapshot: string | null = log.credentialAliasSnapshot ?? null;
  let channelSnapshot: string | null = log.channelSnapshot ?? null;
  if (log.credentialId && (!credentialAliasSnapshot || !channelSnapshot)) {
    try {
      const cred = await prisma.gatewayVendorCredential.findUnique({
        where: { id: log.credentialId },
        select: { alias: true, channel: true },
      });
      if (cred) {
        credentialAliasSnapshot = credentialAliasSnapshot ?? cred.alias;
        channelSnapshot = channelSnapshot ?? cred.channel ?? null;
      }
    } catch {
      // 快照失败不影响日志落库
    }
  }

  await prisma.gatewayRequestLog.update({
    where: { id: logId },
    data: {
      status: patch.status,
      credentialAliasSnapshot: credentialAliasSnapshot ?? undefined,
      channelSnapshot: channelSnapshot ?? undefined,
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
      vendorRequestId: patch.vendorRequestId,
      completedAt: new Date(),
      pricingModelKey: estimate.pricingModelKey,
      pricingTierRaw: estimate.pricingTierRaw,
      billingKind: estimate.billingKind,
      vendorListUnitCostYuan: estimate.vendorListUnitCostYuan,
      estimatedVendorCostYuan: estimate.estimatedVendorCostYuan,
      canonicalModelKey: canonicalModelKey ?? undefined,
      costSnapshotYuan: costSnapshotYuan ?? undefined,
      marginSnapshot: marginSnapshot ?? undefined,
    },
  });

  // —— 统一积分结算（互斥旧钱包；不阻断主流程）——
  try {
    const settledLog = await prisma.gatewayRequestLog.findUnique({ where: { id: logId } });
    if (settledLog) {
      if (patch.status === "SUCCEEDED") {
        await settleSucceededGatewayLog({
          log: settledLog,
          snapshot: costSnapshot,
          metrics: {
            durationSec: videoHints.durationSec,
            totalTokens: tokenMetrics.totalTokens ?? undefined,
            images: resolveBillableImageCountFromLog(settledLog),
          },
        });
      } else if (patch.status === "FAILED") {
        await refundFailedGatewayLog(settledLog);
      }
    }
  } catch (e) {
    console.error("[gateway] 积分结算异常（不影响生成结果）", logId, e);
  }
}

function resolveChatCompletionsBody(
  providerKind: GatewayProviderKind,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const model = typeof body.model === "string" ? body.model : "";
  if (!model) return body;
  if (providerKind === "BAILIAN") {
    return { ...body, model: resolveBailianChatModelKey(model) };
  }
  if (providerKind === "VOLCENGINE") {
    return { ...body, model: resolveVolcengineModelKey(model) };
  }
  if (providerKind === "DEEPSEEK") {
    return { ...body, model: resolveDeepseekChatModelKey(model) };
  }
  return body;
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

  const requestBody = resolveChatCompletionsBody(cred.providerKind, opts.body);
  const bearerKey =
    cred.providerKind === "VOLCENGINE"
      ? resolveVolcengineArkApiKey(cred.apiKey)
      : cred.apiKey;

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerKey}`,
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

  const requestBody = resolveChatCompletionsBody(cred.providerKind, opts.body);
  const bearerKey =
    cred.providerKind === "VOLCENGINE"
      ? resolveVolcengineArkApiKey(cred.apiKey)
      : cred.apiKey;

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerKey}`,
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
