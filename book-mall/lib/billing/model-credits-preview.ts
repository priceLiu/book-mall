/**
 * 统一积分计价预览（替代 Scheme A / ToolBillablePrice）。
 */
import type { CreditCostUnit } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  resolveBillingCanonicalKey,
  resolveCostSnapshot,
} from "@/lib/gateway/credit-billing-guard";
import {
  audioBillableSeconds,
  computeLlmSplitChargeCredits,
  computeUnifiedChargeCredits,
  videoBillableSeconds,
} from "@/lib/pricing/credit-pricing-formulas";

import { libNanoProCanonicalFromModelKey } from "@/lib/billing/lib-nano-pro-canonical";
import {
  sbv1VideoCanonicalFromParams,
  sbv1VideoCanonicalKey,
} from "@/lib/billing/sbv1-video-canonical";

export interface CreditsPreviewInput {
  /** 厂商/工具站模型 key，经别名归口到 canonical */
  modelKey: string;
  /** sbv1 展示变体 id（优先于 modelKey 别名） */
  variantId?: string | null;
  /** 显式 canonical（BFF 已解析时传入） */
  canonicalModelKey?: string | null;
  /** 用户档位「每积分单价」；缺省时读 CreditAccount.pricePerCreditYuan */
  pricePerCreditYuan?: number | null;
  ownerType?: "USER" | "TENANT";
  ownerId?: string;
  units?: number;
  durationSec?: number | null;
  imageCount?: number | null;
  /** LLM 预估 token（缺省 4k in + 2k out） */
  promptTokens?: number | null;
  completionTokens?: number | null;
  /** KIE nano-banana / sbv1 生图清晰度分档（1K / 2K / 4K） */
  resolution?: string | null;
}

export interface CreditsPreviewResult {
  canonicalModelKey: string;
  creditsPerUnit: number;
  pricePerCreditYuan: number;
  estimatedCredits: number;
  listPriceYuanPerUnit: number;
  netCostYuanPerUnit: number;
  unit: CreditCostUnit;
  marginRate: number | null;
}

async function resolvePricePerCredit(input: CreditsPreviewInput): Promise<number | null> {
  if (input.pricePerCreditYuan != null && input.pricePerCreditYuan > 0) {
    return input.pricePerCreditYuan;
  }
  if (input.ownerType && input.ownerId) {
    const acc = await prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: input.ownerType, ownerId: input.ownerId } },
      select: { pricePerCreditYuan: true },
    });
    const ppc = acc?.pricePerCreditYuan;
    if (ppc != null && Number(ppc) > 0) return Number(ppc);
  }
  const plan = await prisma.membershipPlan.findFirst({
    where: { family: "PERSONAL", interval: "MONTH", tier: "高级版", active: true },
    select: { pricePerCreditYuan: true },
  });
  return plan?.pricePerCreditYuan != null ? Number(plan.pricePerCreditYuan) : null;
}

function isAsrCanonical(key: string): boolean {
  return key === "qwen3-asr-flash-filetrans" || key.startsWith("qwen3-asr");
}

function billableUnits(
  unit: CreditCostUnit,
  input: CreditsPreviewInput,
  canonical: string,
): number {
  if (unit === "PER_SEC") {
    if (isAsrCanonical(canonical)) {
      return audioBillableSeconds(input.durationSec ?? input.units ?? null);
    }
    return videoBillableSeconds(input.durationSec ?? input.units ?? null);
  }
  if (unit === "PER_IMAGE") {
    return Math.max(1, Math.round(input.imageCount ?? input.units ?? 1));
  }
  if (unit === "PER_KTOKEN") {
    const pt = input.promptTokens ?? 4000;
    const ct = input.completionTokens ?? 2000;
    return Math.max(1, Math.ceil(pt / 1000) + Math.ceil(ct / 1000));
  }
  return Math.max(1, Math.round(input.units ?? 1));
}

async function resolvePreviewCanonical(input: CreditsPreviewInput): Promise<string | null> {
  const explicit = input.canonicalModelKey?.trim();
  if (explicit) return explicit;

  const mk = input.modelKey?.trim() ?? "";
  const fromVariant = sbv1VideoCanonicalKey(input.variantId);
  if (
    fromVariant &&
    (mk.includes("seedance") || mk.includes("doubao-seedance"))
  ) {
    return fromVariant;
  }

  const fromNano = libNanoProCanonicalFromModelKey(
    input.modelKey,
    input.resolution,
  );
  if (fromNano) return fromNano;

  const fromKey = await resolveBillingCanonicalKey({
    modelKey: input.modelKey,
    inputSummary: input.resolution ? { resolution: input.resolution } : undefined,
  });
  if (fromKey) return fromKey;

  return sbv1VideoCanonicalFromParams({ modelKey: input.modelKey });
}

export async function previewModelCredits(
  input: CreditsPreviewInput,
): Promise<CreditsPreviewResult | null> {
  const canonical = (await resolvePreviewCanonical(input)) ?? input.modelKey.trim();
  if (!canonical) return null;

  const snap = await resolveCostSnapshot(canonical);
  if (!snap?.listPriceYuan || !snap.unit) return null;

  const price = await prisma.modelCreditPrice.findUnique({
    where: { canonicalModelKey: canonical },
    select: {
      creditsPerUnit: true,
      inputCreditsPerKToken: true,
      outputCreditsPerKToken: true,
      inputListPriceYuan: true,
      outputListPriceYuan: true,
      listPriceYuan: true,
    },
  });
  const creditsPerUnit = price?.creditsPerUnit ?? snap.creditsPerUnit;
  if (!creditsPerUnit || creditsPerUnit <= 0) return null;

  const ppc = await resolvePricePerCredit(input);
  if (!ppc || ppc <= 0) return null;

  let estimatedCredits: number;
  if (snap.unit === "PER_KTOKEN") {
    const pt = input.promptTokens ?? 4000;
    const ct = input.completionTokens ?? 2000;
    estimatedCredits = computeLlmSplitChargeCredits({
      inputCreditsPerKToken: price?.inputCreditsPerKToken ?? snap.inputCreditsPerKToken,
      outputCreditsPerKToken: price?.outputCreditsPerKToken ?? snap.outputCreditsPerKToken,
      inputListPriceYuan: price?.inputListPriceYuan != null ? Number(price.inputListPriceYuan) : snap.inputListPriceYuan,
      outputListPriceYuan: price?.outputListPriceYuan != null ? Number(price.outputListPriceYuan) : snap.outputListPriceYuan,
      creditsPerUnit,
      listPriceYuan: snap.listPriceYuan,
      promptTokens: pt,
      completionTokens: ct,
      totalTokens: pt + ct,
      pricePerCreditYuan: ppc,
    });
  } else {
    const units = billableUnits(snap.unit, input, canonical);
    estimatedCredits = computeUnifiedChargeCredits({
      creditsPerUnit,
      units,
    });
  }

  return {
    canonicalModelKey: canonical,
    creditsPerUnit,
    pricePerCreditYuan: ppc,
    estimatedCredits,
    listPriceYuanPerUnit: snap.listPriceYuan,
    netCostYuanPerUnit: snap.netCostYuan,
    unit: snap.unit,
    marginRate: snap.marginRate,
  };
}
