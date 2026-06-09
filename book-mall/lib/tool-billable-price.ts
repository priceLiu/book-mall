/**
 * @deprecated 财务 2.0：计价真值已迁至 ModelCreditPrice。本模块保留 BillableSnapshot 形态供过渡调用方编译。
 */
import { PricingBillingKind } from "@prisma/client";

import { previewModelCredits } from "@/lib/billing/model-credits-preview";
import { videoBillableSeconds } from "@/lib/pricing/credit-pricing-formulas";

export const VISUAL_LAB_ANALYSIS_DEFAULT_SCHEME_A_MODEL_KEY = "qwen3.6-plus";
export const FITTING_ROOM_AI_FIT_DEFAULT_SCHEME_A_MODEL_KEY = "aitryon";
export const IMAGE_TO_VIDEO_DEFAULT_SCHEME_A_MODEL_KEY = "happyhorse-i2v";

export type ResolveBillablePriceOpts = {
  userId?: string;
  schemeARefModelKey?: string | null;
  actuals?: {
    durationSec?: number;
    imageCount?: number;
    inputTokens?: number;
    outputTokens?: number;
    videoSr?: number | string;
    videoAudio?: boolean;
  };
};

export function videoTierCandidates(
  sr: number | string | null | undefined,
  audio: boolean | undefined,
): string[] {
  let srNum: number | null = null;
  if (typeof sr === "number" && Number.isFinite(sr) && sr > 0) srNum = Math.round(sr);
  else if (typeof sr === "string") {
    const m = sr.trim().toUpperCase().match(/^(\d{3,4})P?$/);
    if (m) srNum = parseInt(m[1]!, 10);
  }
  if (srNum == null) return [];
  const base = `${srNum}P`;
  const list: string[] = [];
  if (audio === true) list.push(`${base}|audio`);
  if (audio === false) list.push(`${base}|silent`);
  list.push(base);
  return list;
}

export function normalizeVideoTierRaw(input: number | string | null | undefined): string | null {
  const list = videoTierCandidates(input, undefined);
  return list[0] ?? null;
}

export type BillableSnapshot = {
  points: number;
  unitCostYuan: number | null;
  retailMultiplier: number | null;
  ourUnitYuan: number | null;
  schemeARefModelKey: string | null;
  billablePriceId: string;
  billedVideoSec: number | null;
  billedImageCount: number | null;
  billingKind: PricingBillingKind | null;
};

function billingKindForUnit(unit: string): PricingBillingKind | null {
  if (unit === "PER_SEC") return "VIDEO_MODEL_SPEC";
  if (unit === "PER_IMAGE") return "OUTPUT_IMAGE";
  if (unit === "PER_KTOKEN") return "TOKEN_IN_OUT";
  return null;
}

/** 统一积分计价预览（替代 ToolBillablePrice 查表）。 */
export async function resolveBillableSnapshot(
  _toolKey: string,
  _action: string,
  opts?: ResolveBillablePriceOpts,
): Promise<BillableSnapshot | undefined> {
  const modelKey = opts?.schemeARefModelKey?.trim();
  if (!modelKey) return undefined;

  const preview = await previewModelCredits({
    modelKey,
    ownerType: opts?.userId ? "USER" : undefined,
    ownerId: opts?.userId,
    durationSec: opts?.actuals?.durationSec,
    imageCount: opts?.actuals?.imageCount,
  });
  if (!preview || preview.estimatedCredits <= 0) return undefined;

  const billedVideoSec =
    preview.unit === "PER_SEC" ? videoBillableSeconds(opts?.actuals?.durationSec) : null;
  const billedImageCount =
    preview.unit === "PER_IMAGE" ? Math.max(1, Math.round(opts?.actuals?.imageCount ?? 1)) : null;

  return {
    points: preview.estimatedCredits,
    unitCostYuan: preview.netCostYuanPerUnit,
    retailMultiplier: null,
    ourUnitYuan: preview.listPriceYuanPerUnit,
    schemeARefModelKey: preview.canonicalModelKey,
    billablePriceId: preview.canonicalModelKey,
    billedVideoSec,
    billedImageCount,
    billingKind: billingKindForUnit(preview.unit),
  };
}

export async function resolveBillablePricePoints(
  toolKey: string,
  action: string,
  opts?: ResolveBillablePriceOpts,
): Promise<number | undefined> {
  const snap = await resolveBillableSnapshot(toolKey, action, opts);
  return snap?.points;
}
