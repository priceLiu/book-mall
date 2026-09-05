/**
 * VIP 大额套餐 · 积分测算器 v2（单积分池 · 统一扣分 U₀）
 *
 * 面向大额预充（起订 ¥100,000）。管理员输入充值金额、目标毛利、用量画像，
 * 输出「均衡 / 视频偏重」两套 **总积分** 方案（单池发放）；人人扣分相同，价差仅在 ppc。
 *
 * 毛利护栏（锚定 Seedance 2.0 15s）：
 *   U₀ = 525 积分，净成本 C = ¥15 → 最坏单位成本 c_worst = 15/525
 *   若客户全部用于该模型：毛利 g = 1 − c_worst / ppc，ppc = A / T
 *
 * 用量画像 f（预期视频算力占比，非双池拆分）：
 *   c_blend(f) = (1−f)·c_light + f·c_worst
 *   T = A·(1−m) / c_blend(f)  → 目标毛利 m（按预期用量）
 *   再按 c_worst 验算锚定毛利，不足 22% 护栏时下调 T。
 */
import { DEFAULT_VIDEO_MIN_MARGIN_GUARD } from "@/lib/pricing/credit-pricing-formulas";

/** VIP 起订金额（元）。 */
export const VIP_MIN_AMOUNT_YUAN = 100_000;

/** 企业大额预充积分有效期（年）。公示见 docs/大额vip.md */
export const VIP_CREDIT_VALIDITY_YEARS = 5;

/** 锚定 Seedance 15s（与 unified-credit-formula v2 一致）。 */
export const VIP_SEEDANCE_CHARGE_CREDITS = 525;
export const VIP_SEEDANCE_NET_COST_YUAN = 15;
export const VIP_COST_WORST_PER_CREDIT =
  VIP_SEEDANCE_NET_COST_YUAN / VIP_SEEDANCE_CHARGE_CREDITS;

/** 图文 / 文本等轻量用量保守单位成本（锚定 ÷ M2.5）。 */
export const VIP_DEFAULT_COST_LIGHT_YUAN = 0.016;

/** @deprecated 别名，兼容旧引用 */
export const VIP_DEFAULT_COST_GENERAL_YUAN = VIP_DEFAULT_COST_LIGHT_YUAN;
/** @deprecated 最坏视频单位成本 */
export const VIP_DEFAULT_COST_VIDEO_YUAN = VIP_COST_WORST_PER_CREDIT;

/** 两方案默认「视频算力消耗占比」（用量画像，非池拆分）。 */
export const VIP_GENERAL_HEAVY_VIDEO_FRACTION = 0.15;
export const VIP_VIDEO_HEAVY_VIDEO_FRACTION = 0.4;

/** 锚定毛利护栏（与全站 videoMinMarginGuard 默认一致）。 */
export const VIP_MIN_MARGIN_GUARD = DEFAULT_VIDEO_MIN_MARGIN_GUARD;

/** 默认目标毛利。 */
export const VIP_DEFAULT_TARGET_MARGIN = 0.5;

/** 锚定价（用于展示面值）。 */
export const VIP_ANCHOR_YUAN = 0.04;

export interface VipCreditSchemeInput {
  amountYuan: number;
  /** 目标毛利，0~1（如 0.5 = 50%）。 */
  targetMargin: number;
  /** 预期视频算力消耗占比，0~1（用量画像）。 */
  videoFraction: number;
  costLightYuan?: number;
  costWorstPerCredit?: number;
  anchorYuan?: number;
  minMarginGuard?: number;
}

export interface VipCreditScheme {
  /** 用量画像（视频算力占比） */
  videoFraction: number;
  pricePerCreditYuan: number;
  totalCredits: number;
  /** 按预期用量回算的实际毛利 */
  actualMargin: number;
  /** 锚定 Seedance 15s 单笔毛利（满额最坏消耗） */
  anchorMarginRate: number;
  anchorMarginOk: boolean;
  faceValueYuan: number;
  costYuan: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round(n: number): number {
  return Math.round(n);
}

function blendedUnitCost(
  f: number,
  costLight: number,
  costWorst: number,
): number {
  return (1 - f) * costLight + f * costWorst;
}

function anchorMarginFromPpc(ppc: number, costWorst: number): number {
  if (ppc <= 0) return 0;
  return 1 - costWorst / ppc;
}

/** 单方案测算：给定金额、目标毛利、用量画像 → 总积分（单池）。 */
export function computeVipCreditScheme(input: VipCreditSchemeInput): VipCreditScheme {
  const amount = Math.max(0, input.amountYuan || 0);
  const margin = Math.min(0.99, clamp01(input.targetMargin));
  const f = clamp01(input.videoFraction);
  const costLight = input.costLightYuan ?? VIP_DEFAULT_COST_LIGHT_YUAN;
  const costWorst = input.costWorstPerCredit ?? VIP_COST_WORST_PER_CREDIT;
  const anchor = input.anchorYuan ?? VIP_ANCHOR_YUAN;
  const minGuard = input.minMarginGuard ?? VIP_MIN_MARGIN_GUARD;

  const blendedCost = blendedUnitCost(f, costLight, costWorst);
  const pricePerCreditTarget = blendedCost / (1 - margin);
  let totalCredits =
    pricePerCreditTarget > 0 ? round(amount / pricePerCreditTarget) : 0;

  let ppc = totalCredits > 0 ? amount / totalCredits : 0;
  let anchorMargin = anchorMarginFromPpc(ppc, costWorst);

  if (amount > 0 && anchorMargin < minGuard - 0.0005) {
    const maxPpc = costWorst / (1 - minGuard);
    totalCredits = maxPpc > 0 ? Math.floor(amount / maxPpc) : 0;
    ppc = totalCredits > 0 ? amount / totalCredits : 0;
    anchorMargin = anchorMarginFromPpc(ppc, costWorst);
  }

  const costYuan = totalCredits * blendedCost;
  const actualMargin = amount > 0 ? 1 - costYuan / amount : 0;
  const faceValueYuan = totalCredits * anchor;

  return {
    videoFraction: f,
    pricePerCreditYuan: Math.round(ppc * 1e6) / 1e6,
    totalCredits,
    actualMargin: Math.round(actualMargin * 10000) / 10000,
    anchorMarginRate: Math.round(anchorMargin * 10000) / 10000,
    anchorMarginOk: anchorMargin >= minGuard - 0.0005,
    faceValueYuan: Math.round(faceValueYuan * 100) / 100,
    costYuan: Math.round(costYuan * 100) / 100,
  };
}

export interface VipPackageQuoteInput {
  amountYuan: number;
  targetMargin?: number;
  generalHeavyVideoFraction?: number;
  videoHeavyVideoFraction?: number;
  costLightYuan?: number;
  costWorstPerCredit?: number;
  anchorYuan?: number;
  minMarginGuard?: number;
}

export interface VipPackageQuote {
  amountYuan: number;
  targetMargin: number;
  meetsMinimum: boolean;
  schemeGeneralHeavy: VipCreditScheme;
  schemeVideoHeavy: VipCreditScheme;
}

/** 双方案报价：均衡 / 视频偏重（单池总积分）。 */
export function computeVipPackageQuote(input: VipPackageQuoteInput): VipPackageQuote {
  const amount = Math.max(0, input.amountYuan || 0);
  const targetMargin = input.targetMargin ?? VIP_DEFAULT_TARGET_MARGIN;
  const shared = {
    amountYuan: amount,
    targetMargin,
    costLightYuan: input.costLightYuan,
    costWorstPerCredit: input.costWorstPerCredit,
    anchorYuan: input.anchorYuan,
    minMarginGuard: input.minMarginGuard,
  };
  return {
    amountYuan: amount,
    targetMargin,
    meetsMinimum: amount >= VIP_MIN_AMOUNT_YUAN,
    schemeGeneralHeavy: computeVipCreditScheme({
      ...shared,
      videoFraction:
        input.generalHeavyVideoFraction ?? VIP_GENERAL_HEAVY_VIDEO_FRACTION,
    }),
    schemeVideoHeavy: computeVipCreditScheme({
      ...shared,
      videoFraction: input.videoHeavyVideoFraction ?? VIP_VIDEO_HEAVY_VIDEO_FRACTION,
    }),
  };
}

export interface VipSeatAllocationInput {
  totalCredits: number;
  seats: number;
}

export interface VipSeatAllocation {
  perSeatCredits: number;
  remainderCredits: number;
}

/** 自动平均分配到席位（余数归首席，保证总数不变）。 */
export function computeVipSeatAllocation(
  input: VipSeatAllocationInput,
): VipSeatAllocation {
  const seats = Math.max(1, Math.round(input.seats || 1));
  const total = Math.max(0, Math.round(input.totalCredits));
  const perSeatCredits = Math.floor(total / seats);
  const remainderCredits = total - perSeatCredits * seats;
  return {
    perSeatCredits,
    remainderCredits,
  };
}

/** VIP 充值档位（元）。 */
export const VIP_AMOUNT_TIERS_YUAN = [100_000, 200_000, 500_000] as const;

export interface VipSeatPlan {
  seatIndex: number;
  label: string;
  phone?: string;
  role: "OWNER" | "MEMBER";
  credits: number;
  isChief?: boolean;
}

/** 自动平均分配到各席位（首席席含余数）。 */
export function buildAutoSeatPlans(input: {
  totalCredits: number;
  seats: number;
  ownerPhone?: string;
}): VipSeatPlan[] {
  const seats = Math.max(1, Math.round(input.seats || 1));
  const total = Math.max(0, Math.round(input.totalCredits));
  const alloc = computeVipSeatAllocation({ totalCredits: total, seats });
  return Array.from({ length: seats }, (_, i) => {
    const isChief = i === 0;
    const credits = alloc.perSeatCredits + (isChief ? alloc.remainderCredits : 0);
    return {
      seatIndex: i + 1,
      label: isChief ? "首席席（含余数）" : `席位 ${i + 1}`,
      phone: isChief ? input.ownerPhone?.trim() || undefined : undefined,
      role: isChief ? "OWNER" : "MEMBER",
      credits,
      isChief,
    };
  });
}

/** 手动席位分配合计与总数校验。 */
export function validateVipManualAllocation(input: {
  totalCredits: number;
  perSeat: { credits: number }[];
}): { ok: boolean; reason?: string; sumCredits?: number } {
  const target = Math.max(0, Math.round(input.totalCredits));
  const sumCredits = input.perSeat.reduce(
    (s, x) => s + Math.max(0, Math.round(x.credits)),
    0,
  );
  if (sumCredits !== target) {
    return {
      ok: false,
      reason: `积分分配合计 ${sumCredits.toLocaleString()} ≠ 套餐总数 ${target.toLocaleString()}`,
      sumCredits,
    };
  }
  return { ok: true, sumCredits };
}

/** 算力市场价参考（合规展示，非现金面值）。 */
export function computePowerRefYuan(scheme: Pick<VipCreditScheme, "faceValueYuan">): number {
  return scheme.faceValueYuan;
}
