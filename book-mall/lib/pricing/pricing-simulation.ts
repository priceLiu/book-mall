/**
 * 调价测算预演 + 财务反向验算（财务 2.0 · Phase 4）— 纯函数，无 prisma 依赖。
 *
 * 六维测算：基础成本 / 扣费变动 / 毛利校验 / 月度成本上限 / 营收模拟 / 用户影响。
 * 反向验算：模式 A（目标毛利反推定价）/ 模式 B（保本线核验）。
 *
 * 全部基于 credit-pricing-formulas 的口径（逐档单价派生），保证与运行时扣费一致。
 */
import { computeTierCredits, marginPassesGuard, round2, round4 } from "./credit-pricing-formulas";

/**
 * 护栏判定容差见 credit-pricing-formulas.MARGIN_GUARD_TOLERANCE（0.2%）。
 */

/** 一个档位的定价快照（个人=套餐价/月积分；团队=每席价/每席积分）。 */
export interface TierPricing {
  tier: string;
  priceYuan: number;
  monthlyCredits: number;
  includedSeats?: number; // 个人=1；团队按整单
}

/** 代表性模型成本（用于核算单次生成成本与扣费）。 */
export interface ModelCostBasis {
  canonicalModelKey: string;
  netCostYuan: number; // 渠道净成本（单位价，如元/秒）
  units: number; // 计费单位数（视频=秒数，如 15）
  listPriceYuan: number; // 单位挂牌价（= 净成本 × M）
}

/** 逐档单价 = 套餐价 ÷ (含席位 × 月积分)。 */
export function tierPricePerCredit(p: TierPricing): number {
  const denom = Math.max(1, p.includedSeats ?? 1) * p.monthlyCredits;
  if (denom <= 0) return 0;
  return p.priceYuan / denom;
}

export interface TierSimRow {
  tier: string;
  pricePerCreditYuan: number;
  /** 单次生成扣分（逐档派生） */
  creditsPerGen: number;
  /** 单次生成实收（元）= 扣分 × 单价 */
  revenueYuan: number;
  /** 单次生成成本（元）= 净成本 × 单位数 */
  costYuan: number;
  /** 实际毛利率 */
  marginRate: number;
  /** 月可生成次数 = 月积分 ÷ 扣分 */
  gensPerMonth: number;
  /** 月度成本上限（用户用尽月积分全打视频时的厂商成本） */
  monthlyCostCeilingYuan: number;
  /** 月度成本上限占套餐价比 */
  monthlyCostCeilingRate: number;
  marginPassed: boolean;
}

export interface SimulationReport {
  model: string;
  guard: number;
  baseCostYuan: number; // 维度1：单次基础成本
  rows: TierSimRow[]; // 维度2/3/6：逐档扣费/毛利/用户影响
  worstMargin: number; // 全档最低毛利
  allPassed: boolean; // 维度3：毛利校验是否全通过
}

/** 维度1–6 综合测算：给定一组档位定价 + 代表性模型成本 + 毛利护栏。 */
export function simulatePlanChange(input: {
  tiers: TierPricing[];
  model: ModelCostBasis;
  guard: number;
}): SimulationReport {
  const baseCostYuan = round4(input.model.netCostYuan * input.model.units);
  const totalListYuan = input.model.listPriceYuan * input.model.units;

  const rows: TierSimRow[] = input.tiers.map((t) => {
    const pricePerCreditYuan = tierPricePerCredit(t);
    const creditsPerGen = computeTierCredits(totalListYuan, pricePerCreditYuan);
    const revenueYuan = round4(creditsPerGen * pricePerCreditYuan);
    const marginRate = revenueYuan > 0 ? round4(1 - baseCostYuan / revenueYuan) : 0;
    const gensPerMonth = creditsPerGen > 0 ? Math.floor(t.monthlyCredits / creditsPerGen) : 0;
    const monthlyCostCeilingYuan = round2(gensPerMonth * baseCostYuan);
    const monthlyCostCeilingRate = t.priceYuan > 0 ? round4(monthlyCostCeilingYuan / t.priceYuan) : 0;
    return {
      tier: t.tier,
      pricePerCreditYuan: round4(pricePerCreditYuan),
      creditsPerGen,
      revenueYuan,
      costYuan: baseCostYuan,
      marginRate,
      gensPerMonth,
      monthlyCostCeilingYuan,
      monthlyCostCeilingRate,
      marginPassed: marginPassesGuard(marginRate, input.guard),
    };
  });

  const worstMargin = rows.length ? Math.min(...rows.map((r) => r.marginRate)) : 0;
  return {
    model: input.model.canonicalModelKey,
    guard: input.guard,
    baseCostYuan,
    rows,
    worstMargin,
    allPassed: rows.every((r) => r.marginPassed),
  };
}

/** 营收模拟（维度5）：按假设订阅量估算月营收/成本/毛利。 */
export interface RevenueScenario {
  tier: string;
  subscribers: number;
}
export interface RevenueSimResult {
  totalRevenueYuan: number;
  totalCostCeilingYuan: number;
  blendedMargin: number; // 综合毛利（按成本上限保守口径）
  byTier: { tier: string; revenueYuan: number; costCeilingYuan: number }[];
}
export function simulateRevenue(input: {
  report: SimulationReport;
  tiers: TierPricing[];
  scenarios: RevenueScenario[];
}): RevenueSimResult {
  const priceByTier = new Map(input.tiers.map((t) => [t.tier, t.priceYuan]));
  const rowByTier = new Map(input.report.rows.map((r) => [r.tier, r]));
  let totalRevenueYuan = 0;
  let totalCostCeilingYuan = 0;
  const byTier = input.scenarios.map((s) => {
    const subs = Math.max(0, Math.round(s.subscribers));
    const revenueYuan = round2((priceByTier.get(s.tier) ?? 0) * subs);
    const costCeilingYuan = round2((rowByTier.get(s.tier)?.monthlyCostCeilingYuan ?? 0) * subs);
    totalRevenueYuan += revenueYuan;
    totalCostCeilingYuan += costCeilingYuan;
    return { tier: s.tier, revenueYuan, costCeilingYuan };
  });
  const blendedMargin =
    totalRevenueYuan > 0 ? round4(1 - totalCostCeilingYuan / totalRevenueYuan) : 0;
  return {
    totalRevenueYuan: round2(totalRevenueYuan),
    totalCostCeilingYuan: round2(totalCostCeilingYuan),
    blendedMargin,
    byTier,
  };
}

// ——————————————————— 财务反向验算 ———————————————————

export type ReverseMode = "TARGET_MARGIN" | "BREAK_EVEN";

export interface ReverseCheckResult {
  mode: ReverseMode;
  /** 模式 A：达成目标毛利所需的系数 M 与单位挂牌价 */
  requiredMarginM?: number;
  requiredListPriceYuan?: number;
  /** 模式 A：各档为达目标毛利的扣分（保本以上） */
  requiredCreditsByTier?: { tier: string; creditsPerGen: number }[];
  /** 模式 B：各档保本线（margin=0 时单次最大可亏成本对应扣分）与当前安全垫 */
  breakEven?: {
    tier: string;
    breakEvenCredits: number; // 不亏本所需最少扣分
    currentCredits: number;
    safetyRatio: number; // 当前实收 ÷ 成本（>1 安全）
    safe: boolean;
  }[];
  passed: boolean;
  note: string;
}

/**
 * 模式 A：目标毛利率 → 反推定价。
 *   requiredM = 1/(1-g*)；requiredListPrice = 净成本 × requiredM；
 *   各档 requiredCredits = round(requiredListPrice × units ÷ 档位单价)。
 */
export function reverseTargetMargin(input: {
  targetMargin: number;
  model: ModelCostBasis;
  tiers: TierPricing[];
}): ReverseCheckResult {
  const g = Math.min(Math.max(input.targetMargin, 0), 0.999);
  const requiredMarginM = round4(1 / (1 - g));
  const requiredListPriceYuan = round4(input.model.netCostYuan * requiredMarginM);
  const totalRequiredList = requiredListPriceYuan * input.model.units;
  const requiredCreditsByTier = input.tiers.map((t) => ({
    tier: t.tier,
    creditsPerGen: computeTierCredits(totalRequiredList, tierPricePerCredit(t)),
  }));
  return {
    mode: "TARGET_MARGIN",
    requiredMarginM,
    requiredListPriceYuan,
    requiredCreditsByTier,
    passed: true,
    note: `达成目标毛利 ${(g * 100).toFixed(1)}% 需系数 M=${requiredMarginM}，单位挂牌价 ¥${requiredListPriceYuan}`,
  };
}

/**
 * 模式 B：保本线核验。给定当前各档扣分，核对是否亏本（实收 < 成本）。
 */
/** 维度2：对比调价前后各档单次扣分差异。 */
export function comparePlanChangeCredits(input: {
  oldTiers: TierPricing[];
  newTiers: TierPricing[];
  model: ModelCostBasis;
}): { tier: string; oldCredits: number; newCredits: number; delta: number }[] {
  const totalList = input.model.listPriceYuan * input.model.units;
  const newByTier = new Map(input.newTiers.map((t) => [t.tier, t]));
  return input.oldTiers.map((old) => {
    const neu = newByTier.get(old.tier) ?? old;
    const oldCredits = computeTierCredits(totalList, tierPricePerCredit(old));
    const newCredits = computeTierCredits(totalList, tierPricePerCredit(neu));
    return { tier: old.tier, oldCredits, newCredits, delta: newCredits - oldCredits };
  });
}

/** 维度6：用户影响报告（逐档毛利与月可生成次数）。 */
export function buildUserImpactReport(input: {
  tiers: TierPricing[];
  model: ModelCostBasis;
  guard: number;
}): SimulationReport {
  return simulatePlanChange(input);
}

export function reverseBreakEven(input: {
  model: ModelCostBasis;
  tiers: TierPricing[];
  currentCreditsByTier: { tier: string; creditsPerGen: number }[];
}): ReverseCheckResult {
  const costYuan = input.model.netCostYuan * input.model.units;
  const creditByTier = new Map(input.currentCreditsByTier.map((c) => [c.tier, c.creditsPerGen]));
  const breakEven = input.tiers.map((t) => {
    const ppc = tierPricePerCredit(t);
    const breakEvenCredits = ppc > 0 ? Math.ceil(costYuan / ppc) : 0;
    const currentCredits = creditByTier.get(t.tier) ?? 0;
    const revenue = currentCredits * ppc;
    const safetyRatio = costYuan > 0 ? round4(revenue / costYuan) : 0;
    return {
      tier: t.tier,
      breakEvenCredits,
      currentCredits,
      safetyRatio,
      safe: currentCredits >= breakEvenCredits,
    };
  });
  return {
    mode: "BREAK_EVEN",
    breakEven,
    passed: breakEven.every((b) => b.safe),
    note: `保本线核验：${breakEven.filter((b) => !b.safe).length} 个档位低于保本线`,
  };
}
