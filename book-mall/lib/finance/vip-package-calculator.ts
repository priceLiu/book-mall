/**
 * VIP 大额套餐 · 积分测算器（纯函数，无 prisma / 无副作用）
 *
 * 面向大额预充客户（如 ¥20 万对等积分）。管理员/财务在后台输入充值金额、
 * 目标毛利、视频占比，输出「通用多 / 视频多」两套积分方案供客户选择；毛利由
 * 「调总积分」恒定保证（视频越多、总积分越少）。
 *
 * 口径（保守满额消耗）：
 *   通用积分单位成本 costGeneral = 锚定 ÷ M(2.5) = ¥0.016/积分
 *   视频积分单位成本 costVideo   = 锚定 ÷ M(1.5) = ¥0.0267/积分（保守，比 DB 视频 M 更低毛利）
 *
 * 公式：
 *   c(f) = (1−f)·costGeneral + f·costVideo         // 按视频占比 f 的混合单位成本
 *   p    = c(f) ÷ (1−m)                             // 达到目标毛利 m 的每积分售价
 *   T    = A ÷ p = A·(1−m) ÷ c(f)                   // 总积分
 *   通用 = (1−f)·T ; 视频 = f·T
 */

/** VIP 起订金额（元）。 */
export const VIP_MIN_AMOUNT_YUAN = 100_000;

/** 企业大额预充积分有效期（年）。公示见 docs/大额vip.md */
export const VIP_CREDIT_VALIDITY_YEARS = 5;

/** 保守单位成本（元/积分）。 */
export const VIP_DEFAULT_COST_GENERAL_YUAN = 0.016; // 锚定 0.04 ÷ M 2.5
export const VIP_DEFAULT_COST_VIDEO_YUAN = 0.04 / 1.5; // ≈ 0.026667，锚定 0.04 ÷ M 1.5

/** 两方案默认视频占比。 */
export const VIP_GENERAL_HEAVY_VIDEO_FRACTION = 0.15;
export const VIP_VIDEO_HEAVY_VIDEO_FRACTION = 0.4;

/** 默认目标毛利。 */
export const VIP_DEFAULT_TARGET_MARGIN = 0.5;

/** 锚定价（用于展示面值）。 */
export const VIP_ANCHOR_YUAN = 0.04;

export interface VipCreditSchemeInput {
  amountYuan: number;
  /** 目标毛利，0~1（如 0.5 = 50%）。 */
  targetMargin: number;
  /** 视频占比，0~1（占总积分比例）。 */
  videoFraction: number;
  costGeneralYuan?: number;
  costVideoYuan?: number;
  anchorYuan?: number;
}

export interface VipCreditScheme {
  videoFraction: number;
  pricePerCreditYuan: number;
  totalCredits: number;
  generalCredits: number;
  videoCredits: number;
  /** 取整回算的实际毛利（应 ≈ targetMargin）。 */
  actualMargin: number;
  /** 锚定面值（积分 × anchor），用于对客户展示"相当于原价"。 */
  faceValueYuan: number;
  /** 平台成本（元）。 */
  costYuan: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round(n: number): number {
  return Math.round(n);
}

/** 单方案测算：给定金额、目标毛利、视频占比 → 通用/视频积分分配。 */
export function computeVipCreditScheme(input: VipCreditSchemeInput): VipCreditScheme {
  const amount = Math.max(0, input.amountYuan || 0);
  const margin = Math.min(0.99, clamp01(input.targetMargin));
  const f = clamp01(input.videoFraction);
  const costGeneral = input.costGeneralYuan ?? VIP_DEFAULT_COST_GENERAL_YUAN;
  const costVideo = input.costVideoYuan ?? VIP_DEFAULT_COST_VIDEO_YUAN;
  const anchor = input.anchorYuan ?? VIP_ANCHOR_YUAN;

  const blendedCost = (1 - f) * costGeneral + f * costVideo;
  const pricePerCredit = blendedCost / (1 - margin);
  const totalCredits = pricePerCredit > 0 ? round(amount / pricePerCredit) : 0;
  const videoCredits = round(f * totalCredits);
  const generalCredits = Math.max(0, totalCredits - videoCredits);

  const costYuan = generalCredits * costGeneral + videoCredits * costVideo;
  const actualMargin = amount > 0 ? 1 - costYuan / amount : 0;
  const faceValueYuan = (generalCredits + videoCredits) * anchor;

  return {
    videoFraction: f,
    pricePerCreditYuan: Math.round(pricePerCredit * 1e6) / 1e6,
    totalCredits: generalCredits + videoCredits,
    generalCredits,
    videoCredits,
    actualMargin: Math.round(actualMargin * 10000) / 10000,
    faceValueYuan: Math.round(faceValueYuan * 100) / 100,
    costYuan: Math.round(costYuan * 100) / 100,
  };
}

export interface VipPackageQuoteInput {
  amountYuan: number;
  targetMargin?: number;
  generalHeavyVideoFraction?: number;
  videoHeavyVideoFraction?: number;
  costGeneralYuan?: number;
  costVideoYuan?: number;
  anchorYuan?: number;
}

export interface VipPackageQuote {
  amountYuan: number;
  targetMargin: number;
  meetsMinimum: boolean;
  schemeGeneralHeavy: VipCreditScheme;
  schemeVideoHeavy: VipCreditScheme;
}

/** 双方案报价：通用多 / 视频多，供客户二选一。 */
export function computeVipPackageQuote(input: VipPackageQuoteInput): VipPackageQuote {
  const amount = Math.max(0, input.amountYuan || 0);
  const targetMargin = input.targetMargin ?? VIP_DEFAULT_TARGET_MARGIN;
  const shared = {
    amountYuan: amount,
    targetMargin,
    costGeneralYuan: input.costGeneralYuan,
    costVideoYuan: input.costVideoYuan,
    anchorYuan: input.anchorYuan,
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
  totalGeneralCredits: number;
  totalVideoCredits: number;
  seats: number;
}

export interface VipSeatAllocation {
  perSeatGeneral: number;
  perSeatVideo: number;
  /** 平均分配后余数归第 1 席（保证合计守恒）。 */
  remainderGeneral: number;
  remainderVideo: number;
}

/** 自动平均分配到席位（余数归首席，保证总数不变）。 */
export function computeVipSeatAllocation(
  input: VipSeatAllocationInput,
): VipSeatAllocation {
  const seats = Math.max(1, Math.round(input.seats || 1));
  const perSeatGeneral = Math.floor(input.totalGeneralCredits / seats);
  const perSeatVideo = Math.floor(input.totalVideoCredits / seats);
  return {
    perSeatGeneral,
    perSeatVideo,
    remainderGeneral: input.totalGeneralCredits - perSeatGeneral * seats,
    remainderVideo: input.totalVideoCredits - perSeatVideo * seats,
  };
}

/** VIP 充值档位（元）。 */
export const VIP_AMOUNT_TIERS_YUAN = [100_000, 200_000, 500_000] as const;

export interface VipSeatPlan {
  seatIndex: number;
  label: string;
  phone?: string;
  role: "OWNER" | "MEMBER";
  generalCredits: number;
  videoCredits: number;
  isChief?: boolean;
}

/** 自动平均分配到各席位（首席席含余数）。 */
export function buildAutoSeatPlans(input: {
  totalGeneralCredits: number;
  totalVideoCredits: number;
  seats: number;
  ownerPhone?: string;
}): VipSeatPlan[] {
  const seats = Math.max(1, Math.round(input.seats || 1));
  const alloc = computeVipSeatAllocation({
    totalGeneralCredits: input.totalGeneralCredits,
    totalVideoCredits: input.totalVideoCredits,
    seats,
  });
  return Array.from({ length: seats }, (_, i) => {
    const isChief = i === 0;
    return {
      seatIndex: i + 1,
      label: isChief ? "首席席（含余数）" : `席位 ${i + 1}`,
      phone: isChief ? input.ownerPhone?.trim() || undefined : undefined,
      role: isChief ? "OWNER" : "MEMBER",
      generalCredits: alloc.perSeatGeneral + (isChief ? alloc.remainderGeneral : 0),
      videoCredits: alloc.perSeatVideo + (isChief ? alloc.remainderVideo : 0),
      isChief,
    };
  });
}

/** 手动席位分配合计与池总数校验。 */
export function validateVipManualAllocation(input: {
  totalGeneralCredits: number;
  totalVideoCredits: number;
  perSeat: { generalCredits: number; videoCredits: number }[];
}): { ok: boolean; reason?: string; sumGeneral?: number; sumVideo?: number } {
  const sumGeneral = input.perSeat.reduce((s, x) => s + Math.max(0, Math.round(x.generalCredits)), 0);
  const sumVideo = input.perSeat.reduce((s, x) => s + Math.max(0, Math.round(x.videoCredits)), 0);
  if (sumGeneral !== input.totalGeneralCredits) {
    return {
      ok: false,
      reason: `通用积分分配合计 ${sumGeneral.toLocaleString()} ≠ 池总数 ${input.totalGeneralCredits.toLocaleString()}`,
      sumGeneral,
      sumVideo,
    };
  }
  if (sumVideo !== input.totalVideoCredits) {
    return {
      ok: false,
      reason: `视频积分分配合计 ${sumVideo.toLocaleString()} ≠ 池总数 ${input.totalVideoCredits.toLocaleString()}`,
      sumGeneral,
      sumVideo,
    };
  }
  return { ok: true, sumGeneral, sumVideo };
}

/** 算力市场价参考（合规展示，非现金面值）。 */
export function computePowerRefYuan(scheme: Pick<VipCreditScheme, "faceValueYuan">): number {
  return scheme.faceValueYuan;
}
