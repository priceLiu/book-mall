/**
 * 火山 Seedream · 图层拆分（layer_decomposition）计费
 * 挂牌：https://console.volcengine.com/ark/region:cn-beijing/docs/model-pricing
 */
import {
  computeChargeCreditsFromSnapshot,
  computeCreditsPerUnit,
  computeListPrice,
  computeNetCost,
  DEFAULT_CREDIT_ANCHOR_YUAN,
} from "@/lib/pricing/credit-pricing-formulas";
import { IMAGE_MARGIN_M_NORMAL } from "@/lib/pricing/model-margin-policy";

export const VOLCENGINE_SEEDREAM_LAYER_TIER = "LAYER";

/** 方舟 · Seedream 5.5 输入图单价（元/张） */
export const VOLCENGINE_SEEDREAM_55_INPUT_LIST_YUAN = 0.05;

const VOLC_DISCOUNT = 0.08;

function inputRecord(inputSummary: unknown): Record<string, unknown> | null {
  if (!inputSummary || typeof inputSummary !== "object" || Array.isArray(inputSummary)) {
    return null;
  }
  const input = (inputSummary as Record<string, unknown>).input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function resultRecord(resultSummary: unknown): Record<string, unknown> | null {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return null;
  }
  return resultSummary as Record<string, unknown>;
}

function positiveInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.round(v);
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

export function isVolcengineLayerDecomposeRequest(inputSummary: unknown): boolean {
  const input = inputRecord(inputSummary);
  if (!input) return false;
  if (input.layerDecomposition === true || input.layer_decomposition === true) return true;
  const params = input.parameters;
  if (!params || typeof params !== "object" || Array.isArray(params)) return false;
  return (params as Record<string, unknown>).layer_decomposition === true;
}

export function isDoubaoSeedream55Model(
  modelKey?: string | null,
  canonicalModelKey?: string | null,
): boolean {
  const keys = [modelKey, canonicalModelKey].map((k) => (k ?? "").trim().toLowerCase());
  return keys.some(
    (k) =>
      k === "doubao-seedream-5-5" ||
      k === "doubao-seedream-5-5-261028" ||
      k.includes("seedream-5-5"),
  );
}

export function isDoubaoSeedream50ProModel(
  modelKey?: string | null,
  canonicalModelKey?: string | null,
): boolean {
  const keys = [modelKey, canonicalModelKey].map((k) => (k ?? "").trim().toLowerCase());
  return keys.some(
    (k) =>
      k === "doubao-seedream-5-0-pro" ||
      k === "doubao-seedream-5-0-pro-260628" ||
      (k.includes("seedream-5-0") && k.includes("pro")),
  );
}

/** 图层拆分场景 · 使用成本档 tierRaw=LAYER */
export function resolveVolcengineLayerPricingTier(log: {
  model?: string | null;
  canonicalModelKey?: string | null;
  inputSummary?: unknown;
}): string | null {
  if (!isVolcengineLayerDecomposeRequest(log.inputSummary)) return null;
  if (
    isDoubaoSeedream50ProModel(log.model, log.canonicalModelKey) ||
    isDoubaoSeedream55Model(log.model, log.canonicalModelKey)
  ) {
    return VOLCENGINE_SEEDREAM_LAYER_TIER;
  }
  return null;
}

/**
 * 图层拆分：按输出图层张数计费（方舟按每张输出图单价累加）。
 * 非拆分场景返回 null，走通用 resolveBillableImageCountFromLog。
 */
export function resolveVolcengineLayerOutputBillableCount(log: {
  inputSummary?: unknown;
  resultSummary?: unknown;
}): number | null {
  if (!isVolcengineLayerDecomposeRequest(log.inputSummary)) return null;
  const result = resultRecord(log.resultSummary);
  const fromLayers =
    positiveInt(result?.outputLayerCount) ??
    positiveInt(result?.layerCount) ??
    positiveInt(result?.output_layer_count);
  if (fromLayers != null) return fromLayers;
  return positiveInt(result?.imageCount) ?? 1;
}

/** Seedream 5.5 图层拆分 · 输入图附加积分（¥0.05/张 × 渠道折扣 × M） */
export function volcengineSeedream55LayerInputSurchargeCredits(
  inputImageCount: number,
  pricePerCreditYuan: number | null,
): number {
  const n = Math.max(0, Math.round(inputImageCount));
  if (n === 0) return 0;
  const net = computeNetCost(VOLCENGINE_SEEDREAM_55_INPUT_LIST_YUAN, VOLC_DISCOUNT);
  const listPrice = computeListPrice(net, IMAGE_MARGIN_M_NORMAL);
  const creditsPerInput = computeCreditsPerUnit(listPrice, DEFAULT_CREDIT_ANCHOR_YUAN);
  return computeChargeCreditsFromSnapshot({
    listPriceYuan: listPrice,
    creditsPerUnit: creditsPerInput,
    units: n,
    pricePerCreditYuan,
  });
}