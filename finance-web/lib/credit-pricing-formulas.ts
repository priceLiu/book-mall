/** 与 book-mall/lib/pricing/credit-pricing-formulas.ts 保持同步（纯公式，无 DB）。 */

export const DEFAULT_CREDIT_ANCHOR_YUAN = 0.04;
export const DEFAULT_MARGIN_M = 2.5;
export const DEFAULT_MIN_MARGIN_GUARD = 0.3;
export const DEFAULT_VIDEO_SEC = 15;

export interface PricingConfig {
  creditAnchorYuan: number;
  defaultMarginM: number;
  minMarginGuard: number;
  defaultVideoSec: number;
  videoMarginM: number;
  videoMinMarginGuard: number;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function computeNetCost(listCostYuan: number, discountRate: number): number {
  const d = Math.min(Math.max(discountRate, 0), 1);
  return listCostYuan * (1 - d);
}

export function computeListPrice(netCostYuan: number, marginM: number): number {
  return netCostYuan * marginM;
}

export function computeCreditsPerUnit(listPriceYuan: number, anchorYuan: number): number {
  const anchor = anchorYuan > 0 ? anchorYuan : DEFAULT_CREDIT_ANCHOR_YUAN;
  return Math.max(1, Math.round(listPriceYuan / anchor));
}

export function computeTierGenerations(monthlyCredits: number, creditsPerUnit: number): number {
  if (creditsPerUnit <= 0) return 0;
  return Math.floor(monthlyCredits / creditsPerUnit);
}

export function computeBaseMarginRate(
  netCostYuan: number,
  creditsPerUnit: number,
  anchorYuan: number,
): number {
  const revenue = creditsPerUnit * (anchorYuan > 0 ? anchorYuan : DEFAULT_CREDIT_ANCHOR_YUAN);
  if (revenue <= 0) return 0;
  return round4(1 - netCostYuan / revenue);
}

export function computeEffectiveMargin(input: {
  netCostYuan: number;
  creditsPerUnit: number;
  pricePerCreditYuan: number;
}): number {
  const revenue = input.creditsPerUnit * input.pricePerCreditYuan;
  if (revenue <= 0) return 0;
  return round4(1 - input.netCostYuan / revenue);
}

export function computeCreditPrice(input: {
  listCostYuan: number;
  discountRate: number;
  marginM: number;
  anchorYuan: number;
}) {
  const netCostYuan = computeNetCost(input.listCostYuan, input.discountRate);
  const listPriceYuan = computeListPrice(netCostYuan, input.marginM);
  const creditsPerUnit = computeCreditsPerUnit(listPriceYuan, input.anchorYuan);
  const baseMarginRate = computeBaseMarginRate(netCostYuan, creditsPerUnit, input.anchorYuan);
  return {
    netCostYuan: round4(netCostYuan),
    marginM: input.marginM,
    anchorYuan: input.anchorYuan,
    listPriceYuan: round4(listPriceYuan),
    creditsPerUnit,
    baseMarginRate,
  };
}

export function unitLabel(unit: string): string {
  switch (unit) {
    case "PER_SEC":
      return "秒";
    case "PER_IMAGE":
      return "张";
    case "PER_KTOKEN":
      return "千 token";
    default:
      return "次";
  }
}
