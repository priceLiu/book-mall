/**
 * 对账专用计费用量（与 Gateway 扣费用量可对齐厂商 CSV）。
 */
import type { BillingCategory, GatewayRequestKind, GatewayRequestStatus } from "@prisma/client";

import { resolveBillingCategory } from "@/lib/billing/billing-category";
import { resolveGatewayTokenMetrics } from "@/lib/gateway/gateway-token-metrics";
import {
  resolveBillableAudioSecondsFromLog,
  resolveBillableImageCountFromLog,
  resolveBillableVideoSecondsFromLog,
} from "@/lib/gateway/log-billing-metrics";
import { parseVideoPricingHints } from "@/lib/gateway/log-pricing-hints";
import { videoBillableSeconds } from "@/lib/pricing/credit-pricing-formulas";

import type { TokenDirection, UnitKind } from "./types";
import type { ReconciliationPeriod } from "./period-range";
import { periodKey as toPeriodKey } from "./period-range";

export type ReconciliationLogRow = {
  id?: string;
  status?: GatewayRequestStatus | null;
  requestKind?: GatewayRequestKind | null;
  model?: string | null;
  canonicalModelKey?: string | null;
  billingCategory?: string | null;
  inputSummary?: unknown;
  resultSummary?: unknown;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  hasTokenUsage?: boolean | null;
  pricingTierRaw?: string | null;
};

function resultRecord(resultSummary: unknown): Record<string, unknown> | null {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return null;
  }
  return resultSummary as Record<string, unknown>;
}

function positiveNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** 对账：视频优先成片秒（output_video_duration / usage.duration）。 */
export function resolveReconciliationVideoSeconds(log: ReconciliationLogRow): number {
  const result = resultRecord(log.resultSummary);
  const usage = result?.usage;
  if (usage && typeof usage === "object" && !Array.isArray(usage)) {
    const u = usage as Record<string, unknown>;
    const fromOutput = positiveNum(u.output_video_duration);
    if (fromOutput != null) return fromOutput;
    const fromDuration = positiveNum(u.duration);
    if (fromDuration != null) return fromDuration;
  }
  const fromRaw =
    positiveNum(result?.durationSec) ??
    positiveNum(result?.videoDurationSec) ??
    positiveNum(result?.outputVideoSec);
  if (fromRaw != null) return fromRaw;

  if (log.requestKind === "VIDEO") {
    const hints = parseVideoPricingHints(log.inputSummary);
    return videoBillableSeconds(hints.durationSec);
  }
  return resolveBillableVideoSecondsFromLog(log);
}

export function resolveReconciliationTier(log: ReconciliationLogRow): string | null {
  const fromLog = log.pricingTierRaw?.trim();
  if (fromLog) return fromLog.toUpperCase();
  const hints = parseVideoPricingHints(log.inputSummary);
  if (hints.tierRaw) return hints.tierRaw.toUpperCase();
  const input = log.inputSummary as Record<string, unknown> | null;
  const inner =
    input?.input && typeof input.input === "object"
      ? (input.input as Record<string, unknown>)
      : input;
  const params =
    inner?.parameters && typeof inner.parameters === "object"
      ? (inner.parameters as Record<string, unknown>)
      : null;
  const paramRes = typeof params?.resolution === "string" ? params.resolution : "";
  if (/1080/i.test(paramRes)) return "1080P";
  if (/720/i.test(paramRes)) return "720P";
  if (/480/i.test(paramRes)) return "480P";
  const result = resultRecord(log.resultSummary);
  const usage = result?.usage;
  if (usage && typeof usage === "object" && !Array.isArray(usage)) {
    const sr = (usage as Record<string, unknown>).SR;
    if (sr === 1080 || sr === "1080") return "1080P";
    if (sr === 720 || sr === "720") return "720P";
    if (sr === 480 || sr === "480") return "480P";
  }
  const size = typeof inner?.size === "string" ? inner.size : "";
  if (/1080|1920/i.test(size)) return "1080P";
  if (/720|1280/i.test(size)) return "720P";
  const res = typeof inner?.resolution === "string" ? inner.resolution : "";
  if (/1080/i.test(res)) return "1080P";
  if (/720/i.test(res)) return "720P";
  return null;
}

export function resolveReconciliationAudioSeconds(log: ReconciliationLogRow): number {
  const sec = resolveBillableAudioSecondsFromLog(log, log.resultSummary);
  if (sec != null && sec > 0) return sec;
  const result = resultRecord(log.resultSummary);
  const fromUsage =
    result?.usage && typeof result.usage === "object"
      ? positiveNum((result.usage as Record<string, unknown>).seconds)
      : null;
  if (fromUsage != null) return fromUsage;
  return 0;
}

export function resolveReconciliationKTokens(log: ReconciliationLogRow): number {
  if (log.status && log.status !== "SUCCEEDED") return 0;
  let pt = log.promptTokens ?? 0;
  let ct = log.completionTokens ?? 0;
  let total = log.totalTokens ?? 0;
  if (!log.hasTokenUsage || !total) {
    const tm = resolveGatewayTokenMetrics({
      inputSummary: log.inputSummary,
      resultSummary: log.resultSummary,
      requestKind: log.requestKind ?? undefined,
    });
    pt = tm.promptTokens ?? pt;
    ct = tm.completionTokens ?? ct;
    total = tm.totalTokens ?? total;
  }
  if (total > 0) return total / 1000;
  return 0;
}

export function resolveReconciliationKTokensDirection(
  log: ReconciliationLogRow,
  direction: TokenDirection,
): number {
  if (direction === "input") {
    let pt = log.promptTokens ?? 0;
    if (!pt && log.resultSummary) {
      const tm = resolveGatewayTokenMetrics({
        inputSummary: log.inputSummary,
        resultSummary: log.resultSummary,
        requestKind: log.requestKind ?? undefined,
      });
      pt = tm.promptTokens ?? 0;
    }
    return pt > 0 ? pt / 1000 : 0;
  }
  if (direction === "output") {
    let ct = log.completionTokens ?? 0;
    if (!ct && log.resultSummary) {
      const tm = resolveGatewayTokenMetrics({
        inputSummary: log.inputSummary,
        resultSummary: log.resultSummary,
        requestKind: log.requestKind ?? undefined,
      });
      ct = tm.completionTokens ?? 0;
    }
    return ct > 0 ? ct / 1000 : 0;
  }
  return resolveReconciliationKTokens(log);
}

export function resolveReconciliationChar10K(log: ReconciliationLogRow): number {
  const input = log.inputSummary as Record<string, unknown> | null;
  const inner =
    input?.input && typeof input.input === "object"
      ? (input.input as Record<string, unknown>)
      : input;
  const text = typeof inner?.input === "string" ? inner.input : "";
  if (!text.trim()) return 0;
  return text.length / 10000;
}

export type ReconciliationUsage = {
  unitKind: UnitKind;
  tokenDirection: TokenDirection;
  amount: number;
  tierRaw: string | null;
};

export function resolveReconciliationUsage(log: ReconciliationLogRow): ReconciliationUsage {
  const model = (log.canonicalModelKey ?? log.model ?? "").toLowerCase();
  const category = resolveBillingCategory(
    {
      requestKind: log.requestKind ?? "OTHER",
      inputSummary: log.inputSummary,
      model: log.model,
    },
    log.billingCategory as BillingCategory | null | undefined,
  );
  const tierRaw = resolveReconciliationTier(log);

  if (model.includes("asr") || model.includes("qwen3-asr")) {
    return {
      unitKind: "AUDIO_SEC",
      tokenDirection: "none",
      amount: resolveReconciliationAudioSeconds(log),
      tierRaw,
    };
  }

  if (
    log.requestKind === "TTS" ||
    model.includes("cosyvoice") ||
    model.includes("tts")
  ) {
    return {
      unitKind: "CHAR_10K",
      tokenDirection: "none",
      amount: resolveReconciliationChar10K(log),
      tierRaw,
    };
  }

  if (
    category === "TEXT_TO_IMAGE" ||
    log.requestKind === "IMAGE" ||
    log.requestKind === "TRYON" ||
    model.includes("detect")
  ) {
    return {
      unitKind: "IMAGE",
      tokenDirection: "none",
      amount: resolveBillableImageCountFromLog(log),
      tierRaw: null,
    };
  }

  if (
    log.requestKind === "VIDEO" ||
    category === "IMAGE_TO_VIDEO" ||
    category === "VIDEO_TO_VIDEO"
  ) {
    return {
      unitKind: "SEC",
      tokenDirection: "none",
      amount: resolveReconciliationVideoSeconds(log),
      tierRaw,
    };
  }

  if (category === "TEXT" || category === "VIDEO_UNDERSTANDING" || log.requestKind === "CHAT") {
    return {
      unitKind: "KTOKEN",
      tokenDirection: "none",
      amount: resolveReconciliationKTokens(log),
      tierRaw,
    };
  }

  return { unitKind: "CALL", tokenDirection: "none", amount: 1, tierRaw };
}

export function buildJoinKey(input: {
  vendor: string;
  modelKey: string;
  tierRaw: string | null;
  unitKind: UnitKind;
  tokenDirection: TokenDirection;
  /** YYYYMM 或 periodKey（YYYYMMDD_YYYYMMDD） */
  month?: string;
  periodKey?: string;
  period?: ReconciliationPeriod;
}): string {
  const pk =
    input.periodKey ??
    (input.period ? toPeriodKey(input.period) : null) ??
    input.month ??
    "";
  return [
    input.vendor,
    input.modelKey,
    input.tierRaw ?? "-",
    input.unitKind,
    input.tokenDirection,
    pk,
  ].join("|");
}
