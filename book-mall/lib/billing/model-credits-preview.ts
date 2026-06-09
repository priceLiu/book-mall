/**
 * 统一积分计价预览（替代 Scheme A / ToolBillablePrice）。
 */
import type { CreditCostUnit } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveCanonicalModelKey, resolveCostSnapshot } from "@/lib/gateway/credit-billing-guard";
import {
  computeTierCredits,
  videoBillableSeconds,
} from "@/lib/pricing/credit-pricing-formulas";

export interface CreditsPreviewInput {
  /** 厂商/工具站模型 key，经别名归口到 canonical */
  modelKey: string;
  /** 用户档位「每积分单价」；缺省时读 CreditAccount.pricePerCreditYuan */
  pricePerCreditYuan?: number | null;
  ownerType?: "USER" | "TENANT";
  ownerId?: string;
  units?: number;
  durationSec?: number | null;
  imageCount?: number | null;
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

function billableUnits(
  unit: CreditCostUnit,
  input: CreditsPreviewInput,
): number {
  if (unit === "PER_SEC") {
    return videoBillableSeconds(input.durationSec ?? input.units ?? null);
  }
  if (unit === "PER_IMAGE") {
    return Math.max(1, Math.round(input.imageCount ?? input.units ?? 1));
  }
  if (unit === "PER_KTOKEN") {
    return Math.max(1, Math.ceil((input.units ?? 1000) / 1000));
  }
  return Math.max(1, Math.round(input.units ?? 1));
}

export async function previewModelCredits(
  input: CreditsPreviewInput,
): Promise<CreditsPreviewResult | null> {
  const canonical =
    (await resolveCanonicalModelKey(input.modelKey)) ?? input.modelKey.trim();
  if (!canonical) return null;

  const snap = await resolveCostSnapshot(canonical);
  if (!snap?.listPriceYuan || !snap.unit) return null;

  const price = await prisma.modelCreditPrice.findUnique({
    where: { canonicalModelKey: canonical },
    select: { creditsPerUnit: true },
  });
  const creditsPerUnit = price?.creditsPerUnit ?? snap.creditsPerUnit;
  if (!creditsPerUnit || creditsPerUnit <= 0) return null;

  const ppc = await resolvePricePerCredit(input);
  if (!ppc || ppc <= 0) return null;

  const units = billableUnits(snap.unit, input);
  const totalList = snap.listPriceYuan * units;
  const estimatedCredits = computeTierCredits(totalList, ppc);

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
