/**
 * 统一积分计费 — 纯公式（无副作用、无 prisma 依赖，可在客户端复用）。
 *
 *   C = listCost × (1 - discountRate)          // 渠道净成本
 *   P = C × M                                  // 挂牌价
 *   U = round(P ÷ anchor)                       // 积分/次
 *   N = floor(monthlyCredits ÷ U)              // 次数
 *   g = 1 - C ÷ (U × pricePerCreditYuan)       // 实际毛利
 */
import type { CreditCostUnit } from "@prisma/client";

export const DEFAULT_CREDIT_ANCHOR_YUAN = 0.04;
export const DEFAULT_MARGIN_M = 2.5;
export const DEFAULT_MIN_MARGIN_GUARD = 0.3;
export const DEFAULT_VIDEO_SEC = 5;

export interface PricingConfig {
  creditAnchorYuan: number;
  defaultMarginM: number;
  minMarginGuard: number;
  defaultVideoSec: number;
}

export const FALLBACK_PRICING_CONFIG: PricingConfig = {
  creditAnchorYuan: DEFAULT_CREDIT_ANCHOR_YUAN,
  defaultMarginM: DEFAULT_MARGIN_M,
  minMarginGuard: DEFAULT_MIN_MARGIN_GUARD,
  defaultVideoSec: DEFAULT_VIDEO_SEC,
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** 渠道净成本：listCost × (1 - discountRate) */
export function computeNetCost(listCostYuan: number, discountRate: number): number {
  const d = Math.min(Math.max(discountRate, 0), 1);
  return listCostYuan * (1 - d);
}

/** 挂牌价 P = 净成本 C × M */
export function computeListPrice(netCostYuan: number, marginM: number): number {
  return netCostYuan * marginM;
}

/** 积分/次 U = round(挂牌价 ÷ 锚定)，至少 1 积分 */
export function computeCreditsPerUnit(listPriceYuan: number, anchorYuan: number): number {
  const anchor = anchorYuan > 0 ? anchorYuan : DEFAULT_CREDIT_ANCHOR_YUAN;
  return Math.max(1, Math.round(listPriceYuan / anchor));
}

/** 某月配额积分能生成多少次：N = floor(credits ÷ U) */
export function computeTierGenerations(monthlyCredits: number, creditsPerUnit: number): number {
  if (creditsPerUnit <= 0) return 0;
  return Math.floor(monthlyCredits / creditsPerUnit);
}

/** 标准毛利率（锚定售价口径）：g = 1 - C ÷ (U × anchor) */
export function computeBaseMarginRate(
  netCostYuan: number,
  creditsPerUnit: number,
  anchorYuan: number,
): number {
  const revenue = creditsPerUnit * (anchorYuan > 0 ? anchorYuan : DEFAULT_CREDIT_ANCHOR_YUAN);
  if (revenue <= 0) return 0;
  return round4(1 - netCostYuan / revenue);
}

/** 档位实际毛利：g_tier = 1 - C ÷ (U × pricePerCreditYuan) */
export function computeEffectiveMargin(input: {
  netCostYuan: number;
  creditsPerUnit: number;
  pricePerCreditYuan: number;
}): number {
  const revenue = input.creditsPerUnit * input.pricePerCreditYuan;
  if (revenue <= 0) return 0;
  return round4(1 - input.netCostYuan / revenue);
}

export interface CreditPriceComputation {
  netCostYuan: number;
  marginM: number;
  anchorYuan: number;
  listPriceYuan: number;
  creditsPerUnit: number;
  baseMarginRate: number;
  formulaSnapshot: Record<string, unknown>;
}

/** 单模型完整报价（净成本 → 挂牌价 → 积分/次 → 实际毛利 + 公式快照） */
export function computeCreditPrice(input: {
  listCostYuan: number;
  discountRate: number;
  marginM: number;
  anchorYuan: number;
}): CreditPriceComputation {
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
    formulaSnapshot: {
      version: 1,
      inputs: {
        listCostYuan: input.listCostYuan,
        discountRate: input.discountRate,
        marginM: input.marginM,
        anchorYuan: input.anchorYuan,
      },
      steps: {
        netCostYuan: round4(netCostYuan),
        listPriceYuan: round4(listPriceYuan),
        creditsPerUnit,
        baseMarginRate,
      },
      formulas: {
        netCost: "C = listCost × (1 - discountRate)",
        listPrice: "P = C × M",
        creditsPerUnit: "U = round(P ÷ anchor)",
        margin: "g = 1 - C ÷ (U × anchor)",
      },
    },
  };
}

export interface ByokResourceUsage {
  ossGbMonth?: number;
  egressGb?: number;
  taskCount?: number;
}
export interface ByokCoefficients {
  ossGbMonthYuan: number;
  egressGbYuan: number;
  taskCountYuan: number;
}

/** BYOK 费 = 技术服务费 + Σ(资源用量 × 资源系数) */
export function computeByokFee(input: {
  techServiceFeeYuan: number;
  usage: ByokResourceUsage;
  coefficients: ByokCoefficients;
}): {
  techServiceFeeYuan: number;
  resourceFeeYuan: number;
  totalYuan: number;
  breakdown: { resourceType: string; quantity: number; coefficientYuan: number; costYuan: number }[];
} {
  const { usage, coefficients } = input;
  const breakdown: {
    resourceType: string;
    quantity: number;
    coefficientYuan: number;
    costYuan: number;
  }[] = [];
  const push = (type: string, qty: number, coef: number) => {
    if (qty > 0) {
      breakdown.push({ resourceType: type, quantity: qty, coefficientYuan: coef, costYuan: round4(qty * coef) });
    }
  };
  push("OSS_GB_MONTH", usage.ossGbMonth ?? 0, coefficients.ossGbMonthYuan);
  push("EGRESS_GB", usage.egressGb ?? 0, coefficients.egressGbYuan);
  push("TASK_COUNT", usage.taskCount ?? 0, coefficients.taskCountYuan);
  const resourceFeeYuan = round4(breakdown.reduce((s, b) => s + b.costYuan, 0));
  return {
    techServiceFeeYuan: round2(input.techServiceFeeYuan),
    resourceFeeYuan,
    totalYuan: round2(input.techServiceFeeYuan + resourceFeeYuan),
    breakdown,
  };
}

/* ============================ 团队席位（按席计价 · 整单量价） ============================ */

export interface SeatBand {
  seatMin: number;
  seatMax: number | null;
  perSeatPriceYuan: number;
  perSeatCredits: number;
}

/** 选取覆盖 seats 的席位带（seatMin ≤ seats ≤ seatMax，超出取最后一档）。 */
export function pickSeatBand(bands: SeatBand[], seats: number): SeatBand | null {
  return (
    bands.find((b) => seats >= b.seatMin && (b.seatMax == null || seats <= b.seatMax)) ??
    bands[bands.length - 1] ??
    null
  );
}

export interface TeamSeatQuote {
  seats: number;
  perSeatPriceYuan: number;
  perSeatCredits: number;
  totalPriceYuan: number;
  creditsPool: number;
}

/**
 * 按席计价（整单量价：席数越多，每席越便宜）。
 *   总价 = 每席价(命中档) × 席数
 *   共享积分池 = 每席积分(命中档) × 席数
 */
export function computeTeamSeatQuote(input: {
  bands: SeatBand[];
  minSeats: number;
  fallbackPerSeatPriceYuan: number;
  fallbackPerSeatCredits: number;
  seats: number;
}): TeamSeatQuote {
  const minSeats = Math.max(1, Math.round(input.minSeats || 1));
  const seats = Math.max(minSeats, Math.round(input.seats || minSeats));
  const band = pickSeatBand(input.bands, seats);
  const perSeatPriceYuan = band ? band.perSeatPriceYuan : input.fallbackPerSeatPriceYuan;
  const perSeatCredits = band ? band.perSeatCredits : input.fallbackPerSeatCredits;
  return {
    seats,
    perSeatPriceYuan,
    perSeatCredits,
    totalPriceYuan: round2(perSeatPriceYuan * seats),
    creditsPool: perSeatCredits * seats,
  };
}

/** 单位标签（对外文案） */
export function unitLabel(unit: CreditCostUnit | string): string {
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
