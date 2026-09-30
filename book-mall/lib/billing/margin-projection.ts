/**
 * 订阅档位 × 代表模型的毛利测算（只读演算）。
 * 维度：个人/团队 × 月/年，各 4 档（豪华已下架）。
 * 模型：GPT Image 2.0、Wan 3.0 720P、HappyHorse 1.1 720P。
 */
import {
  computeCreditPrice,
  computeNetCost,
  computePricePerCredit,
  computeTierGenerations,
  computeUnifiedChargeCredits,
  DEFAULT_CREDIT_ANCHOR_YUAN,
  DEFAULT_VIDEO_SEC,
  type PricingConfig,
  round2,
  round4,
} from "@/lib/pricing/credit-pricing-formulas";
import { resolveModelMarginM } from "@/lib/pricing/model-margin-policy";
import { CREDIT_TOPUP_PACKS } from "@/lib/billing/credit-topup-packs";
import {
  PERSONAL_MONTH_CREDITS,
  PERSONAL_MONTH_PRICES,
  TEAM_SEAT_MONTH_CREDITS,
  yearCreditsFromMonth,
} from "@/lib/billing/membership-credit-ladder";
import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";

export const MARGIN_PROJECTION_FORMULA_VERSION = 4;

export const MARGIN_PROJECTION_FORMULA_LINES = [
  "C = 挂牌 × (1 − 折扣)                  // 净成本，元/张 或 元/秒；见模型成本页",
  "M = 成本档 marginM                     // 图 / 视频默认 1.5",
  "P = C × M                             // 对用户人民币挂牌价（元/计费单位），不是积分",
  "U₀ = round2(P ÷ 0.03)，最低 0.01       // 积分/单位；已发布报价优先（= 现网实扣）",
  "units = 图片 1 张；视频默认 15 秒一条",
  "一次扣分 = U₀ × units",
  "N = floor(月积分池 ÷ 一次扣分)         // 该档最多可生成张/条",
  "积分池 = 含席位数 × 月积分             // 个人席位=1；团队月积分=每席积分",
  "厂商成本 = N × C × units",
  "整月毛利 = 套餐实收 − 厂商成本         // 一定有数：剩积分没打完也算钱已收",
  "整月毛利率 = 整月毛利 ÷ 套餐实收",
] as const;

export type MarginProjectionFamily = "PERSONAL" | "TEAM";
export type MarginProjectionSource = "live" | "seed";
export type ModelQuoteSource = "published" | "cost-profile" | "seed";

export type MarginProjectionPlanInput = {
  family: MarginProjectionFamily;
  tier: string;
  sortOrder: number;
  priceYuan: number;
  /** 个人=月积分池；团队=每席月积分 */
  monthlyCredits: number;
  includedSeats: number;
};

export type MarginProjectionModelQuote = {
  id: string;
  label: string;
  canonicalModelKey: string;
  vendor: string;
  unit: "PER_IMAGE" | "PER_SEC";
  tierRaw: string;
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
  marginM: number;
  listPriceYuan: number;
  creditsPerUnit: number;
  units: number;
  chargeCredits: number;
  clipCostYuan: number;
  source: ModelQuoteSource;
  /** 按当前成本档重算的 U₀；与已发布 creditsPerUnit 不同说明报价待重新发布 */
  computedCreditsPerUnit: number;
  note?: string;
};

export type MarginProjectionCell = {
  modelId: string;
  generations: number;
  usedCredits: number;
  leftoverCredits: number;
  vendorCostYuan: number;
  consumedRevenueYuan: number;
  monthProfitYuan: number;
  monthMarginRate: number;
};

export type MarginProjectionTierRow = {
  family: MarginProjectionFamily;
  tier: string;
  sortOrder: number;
  priceYuan: number;
  monthlyCredits: number;
  includedSeats: number;
  creditsPool: number;
  pricePerCreditYuan: number;
  cells: MarginProjectionCell[];
};

export type MarginProjectionDimension = {
  id: "personal-month" | "team-month-seats" | "personal-year" | "team-year-seats" | "credit-topup";
  title: string;
  description: string;
  family: MarginProjectionFamily;
  seats: number;
  planSource: MarginProjectionSource;
  rows: MarginProjectionTierRow[];
};

export type MarginProjectionPayload = {
  formulaVersion: number;
  formulaLines: readonly string[];
  assumptions: string[];
  howToRead: string[];
  pricing: {
    creditAnchorYuan: number;
    defaultVideoSec: number;
    imageVideoMarginM: number;
    costBasis: "net";
  };
  models: MarginProjectionModelQuote[];
  dimensions: MarginProjectionDimension[];
};

export const MARGIN_PROJECTION_FALLBACK_PLANS: MarginProjectionPlanInput[] = [
  { family: "PERSONAL", tier: "标准版", sortOrder: 1, priceYuan: PERSONAL_MONTH_PRICES.标准版, monthlyCredits: PERSONAL_MONTH_CREDITS.标准版, includedSeats: 1 },
  { family: "PERSONAL", tier: "进阶版", sortOrder: 2, priceYuan: PERSONAL_MONTH_PRICES.进阶版, monthlyCredits: PERSONAL_MONTH_CREDITS.进阶版, includedSeats: 1 },
  { family: "PERSONAL", tier: "高级版", sortOrder: 3, priceYuan: PERSONAL_MONTH_PRICES.高级版, monthlyCredits: PERSONAL_MONTH_CREDITS.高级版, includedSeats: 1 },
  { family: "PERSONAL", tier: "至尊版", sortOrder: 4, priceYuan: PERSONAL_MONTH_PRICES.至尊版, monthlyCredits: PERSONAL_MONTH_CREDITS.至尊版, includedSeats: 1 },
  {
    family: "TEAM",
    tier: "标准版",
    sortOrder: 1,
    priceYuan: 597,
    monthlyCredits: TEAM_SEAT_MONTH_CREDITS.标准版,
    includedSeats: TEAM_MIN_INCLUDED_SEATS,
  },
  {
    family: "TEAM",
    tier: "进阶版",
    sortOrder: 2,
    priceYuan: 2067,
    monthlyCredits: TEAM_SEAT_MONTH_CREDITS.进阶版,
    includedSeats: TEAM_MIN_INCLUDED_SEATS,
  },
  {
    family: "TEAM",
    tier: "高级版",
    sortOrder: 3,
    priceYuan: 3597,
    monthlyCredits: TEAM_SEAT_MONTH_CREDITS.高级版,
    includedSeats: TEAM_MIN_INCLUDED_SEATS,
  },
  {
    family: "TEAM",
    tier: "至尊版",
    sortOrder: 4,
    priceYuan: 5997,
    monthlyCredits: TEAM_SEAT_MONTH_CREDITS.至尊版,
    includedSeats: TEAM_MIN_INCLUDED_SEATS,
  },
];

export const MARGIN_PROJECTION_TOPUP_PLANS: MarginProjectionPlanInput[] = CREDIT_TOPUP_PACKS.map((p, i) => ({
  family: "PERSONAL",
  tier: p.label,
  sortOrder: i + 1,
  priceYuan: p.priceYuan,
  monthlyCredits: p.credits,
  includedSeats: 1,
}));

export type MarginProjectionModelSpec = {
  id: string;
  label: string;
  keys: string[];
  vendor: string;
  unit: "PER_IMAGE" | "PER_SEC";
  tierRaw: string;
  listCostYuan: number;
  discountRate: number;
  note?: string;
};

/** 页面固定测算模型（成本档缺省时回退这些牌价） */
export const MARGIN_PROJECTION_MODEL_SPECS: MarginProjectionModelSpec[] = [
  {
    id: "gpt-image-2",
    label: "GPT Image 2.0",
    keys: ["gpt-image-2"],
    vendor: "kie",
    unit: "PER_IMAGE",
    tierRaw: "",
    listCostYuan: 0.25,
    discountRate: 0,
    note: "KIE 挂牌 ¥0.25/张。",
  },
  {
    id: "wan3.0-video",
    label: "Wan 3.0 · 720P",
    keys: ["wan3.0-video"],
    vendor: "aliyun",
    unit: "PER_SEC",
    tierRaw: "720P",
    listCostYuan: 0.6,
    discountRate: 0,
    note: "华北2 挂牌 ¥0.60/秒。文生无参考视频按 15s；带参考视频时秒数=输入+输出。",
  },
  {
    id: "happyhorse-1.1",
    label: "HappyHorse 1.1 · 720P",
    keys: ["happyhorse-1.1-t2v", "happyhorse-1.1-i2v", "happyhorse-1.1-r2v", "happyhorse-1.1"],
    vendor: "aliyun",
    unit: "PER_SEC",
    tierRaw: "720P",
    listCostYuan: 0.9,
    discountRate: 0,
    note: "官方挂牌 ¥0.90/秒。",
  },
];

export function creditsPoolForPlan(plan: Pick<MarginProjectionPlanInput, "monthlyCredits" | "includedSeats">): number {
  return Math.max(1, plan.includedSeats) * plan.monthlyCredits;
}

export function yearPlansFromMonth(plans: MarginProjectionPlanInput[]): MarginProjectionPlanInput[] {
  return plans.map((p) => ({
    ...p,
    priceYuan: p.priceYuan * 10,
    monthlyCredits: yearCreditsFromMonth(p.monthlyCredits),
  }));
}

export function quoteProjectionModel(
  spec: MarginProjectionModelSpec,
  pricing: Pick<PricingConfig, "creditAnchorYuan" | "defaultVideoSec">,
  override?: {
    canonicalModelKey?: string;
    listCostYuan?: number;
    discountRate?: number;
    netCostYuan?: number;
    marginM?: number;
    creditsPerUnit?: number;
    listPriceYuan?: number;
    source?: ModelQuoteSource;
  },
): MarginProjectionModelQuote {
  const listCostYuan = override?.listCostYuan ?? spec.listCostYuan;
  const discountRate = Math.min(Math.max(override?.discountRate ?? spec.discountRate, 0), 1);
  const netCostYuan = round4(
    override?.netCostYuan != null && override.netCostYuan > 0
      ? override.netCostYuan
      : computeNetCost(listCostYuan, discountRate),
  );
  const marginM = resolveModelMarginM({
    unit: spec.unit,
    netCostYuan,
    listCostYuan,
    marginM: override?.marginM,
  });
  const computed = computeCreditPrice({
    listCostYuan: netCostYuan,
    discountRate: 0,
    marginM,
    anchorYuan: pricing.creditAnchorYuan,
  });
  const published = override?.creditsPerUnit != null && override.creditsPerUnit > 0;
  const creditsPerUnit = published ? override!.creditsPerUnit! : computed.creditsPerUnit;
  const listPriceYuan =
    published && override?.listPriceYuan != null && override.listPriceYuan > 0
      ? override.listPriceYuan
      : computed.listPriceYuan;
  const units = spec.unit === "PER_SEC" ? Math.max(1, pricing.defaultVideoSec) : 1;
  const chargeCredits = computeUnifiedChargeCredits({ creditsPerUnit, units });
  return {
    id: spec.id,
    label: spec.label,
    canonicalModelKey: override?.canonicalModelKey ?? spec.keys[0]!,
    vendor: spec.vendor,
    unit: spec.unit,
    tierRaw: spec.tierRaw,
    listCostYuan,
    discountRate,
    netCostYuan,
    marginM,
    listPriceYuan,
    creditsPerUnit,
    units,
    chargeCredits,
    clipCostYuan: round4(netCostYuan * units),
    source: override?.source ?? "seed",
    computedCreditsPerUnit: computed.creditsPerUnit,
    note: spec.note,
  };
}

export function projectTierAgainstModels(
  plan: MarginProjectionPlanInput,
  models: MarginProjectionModelQuote[],
): MarginProjectionTierRow {
  const creditsPool = creditsPoolForPlan(plan);
  const pricePerCreditYuan = computePricePerCredit(plan.priceYuan, creditsPool);
  const cells = models.map((model) => {
    const generations = computeTierGenerations(creditsPool, model.chargeCredits);
    const usedCredits = round2(generations * model.chargeCredits);
    const leftoverCredits = round2(creditsPool - usedCredits);
    const vendorCostYuan = round2(generations * model.clipCostYuan);
    const consumedRevenueYuan = round2(usedCredits * pricePerCreditYuan);
    const monthProfitYuan = round2(plan.priceYuan - vendorCostYuan);
    const monthMarginRate = plan.priceYuan > 0 ? round4(monthProfitYuan / plan.priceYuan) : 0;
    return {
      modelId: model.id,
      generations,
      usedCredits,
      leftoverCredits,
      vendorCostYuan,
      consumedRevenueYuan,
      monthProfitYuan,
      monthMarginRate,
    };
  });
  return {
    family: plan.family,
    tier: plan.tier,
    sortOrder: plan.sortOrder,
    priceYuan: plan.priceYuan,
    monthlyCredits: plan.monthlyCredits,
    includedSeats: plan.includedSeats,
    creditsPool,
    pricePerCreditYuan: round4(pricePerCreditYuan),
    cells,
  };
}

export function buildMarginProjection(input: {
  pricing?: Pick<PricingConfig, "creditAnchorYuan" | "defaultVideoSec">;
  personalPlans?: MarginProjectionPlanInput[];
  teamPlans?: MarginProjectionPlanInput[];
  personalYearPlans?: MarginProjectionPlanInput[];
  teamYearPlans?: MarginProjectionPlanInput[];
  personalSource?: MarginProjectionSource;
  teamSource?: MarginProjectionSource;
  models?: MarginProjectionModelQuote[];
}): MarginProjectionPayload {
  const pricing = {
    creditAnchorYuan: input.pricing?.creditAnchorYuan ?? DEFAULT_CREDIT_ANCHOR_YUAN,
    defaultVideoSec: input.pricing?.defaultVideoSec ?? DEFAULT_VIDEO_SEC,
  };
  const models =
    input.models ??
    MARGIN_PROJECTION_MODEL_SPECS.map((spec) => quoteProjectionModel(spec, pricing));
  const personalPlans =
    input.personalPlans && input.personalPlans.length > 0
      ? input.personalPlans
      : MARGIN_PROJECTION_FALLBACK_PLANS.filter((p) => p.family === "PERSONAL");
  const teamPlans =
    input.teamPlans && input.teamPlans.length > 0
      ? input.teamPlans
      : MARGIN_PROJECTION_FALLBACK_PLANS.filter((p) => p.family === "TEAM");
  const teamSeats = teamPlans[0]?.includedSeats ?? TEAM_MIN_INCLUDED_SEATS;
  const personalYearPlans =
    input.personalYearPlans && input.personalYearPlans.length > 0
      ? input.personalYearPlans
      : yearPlansFromMonth(personalPlans);
  const teamYearPlans =
    input.teamYearPlans && input.teamYearPlans.length > 0
      ? input.teamYearPlans
      : yearPlansFromMonth(teamPlans);

  return {
    formulaVersion: MARGIN_PROJECTION_FORMULA_VERSION,
    formulaLines: MARGIN_PROJECTION_FORMULA_LINES,
    howToRead: [
      "先看「套餐实收」：用户这个月付给平台多少钱。",
      "再看「能生成」：这些积分如果只打这一个模型，最多出多少张/条。",
      "「厂商成本」= 条数 × 净成本 C。C = 挂牌 × (1 − 折扣)，在模型成本页看。",
      "「整月毛利」= 套餐实收 − 厂商成本。不是空列：有实收就一定有毛利数字。",
      "三种模型是三套互斥情景，不要把图片张数和视频条数加在一起。",
    ],
    assumptions: [
      "C 与 M 取模型成本页生效中的成本档；一次扣分优先取已发布报价，与现网扣分一致。",
      "调价入口：折扣与挂牌在模型成本页改，M 改成本档 marginM，改完需在积分报价页重新发布才影响现网扣分。",
      "每个档位的月积分只打这一种模型（图片或视频互斥，不是三种加总）。",
      `视频按 ${pricing.defaultVideoSec} 秒一条、720P；实际更短则条数增加，整月毛利几乎不变。`,
      "万相 3.0 带参考视频时，计费秒数 = 输入 + 输出，条数会变少。",
      "整月毛利一定有数 = 套餐实收 − 厂商成本。剩积分没打完，那笔钱仍算已收。",
      "年付价 = 月价 × 10，积分 = 月积分 × 12；打满时毛利低于月付。",
      "积分包 ppc 拉开，且不低于至尊 0.04，避免比会员还便宜。",
    ],
    pricing: {
      creditAnchorYuan: pricing.creditAnchorYuan,
      defaultVideoSec: pricing.defaultVideoSec,
      imageVideoMarginM: 1.5,
      costBasis: "net",
    },
    models,
    dimensions: [
      {
        id: "personal-month",
        title: "个人 · 月付 4 档",
        description: "一人订阅、席位=1。积分池即套餐月积分。主打进阶 / 高级。",
        family: "PERSONAL",
        seats: 1,
        planSource: input.personalSource ?? "seed",
        rows: personalPlans
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((plan) => projectTierAgainstModels(plan, models)),
      },
      {
        id: "team-month-seats",
        title: `团队 · ${teamSeats} 席月付 4 档`,
        description: `套餐实收为含席位价；积分池 = ${teamSeats} × 每席月积分。`,
        family: "TEAM",
        seats: teamSeats,
        planSource: input.teamSource ?? "seed",
        rows: teamPlans
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((plan) => projectTierAgainstModels(plan, models)),
      },
      {
        id: "personal-year",
        title: "个人 · 年付 4 档",
        description: "年价 = 月价 × 10，年积分 = 月积分 × 12。打满时毛利低于月付。",
        family: "PERSONAL",
        seats: 1,
        planSource: input.personalSource ?? "seed",
        rows: personalYearPlans
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((plan) => projectTierAgainstModels(plan, models)),
      },
      {
        id: "team-year-seats",
        title: `团队 · ${teamSeats} 席年付 4 档`,
        description: `年价 = 月价 × 10；积分池 = ${teamSeats} × 每席年积分。`,
        family: "TEAM",
        seats: teamSeats,
        planSource: input.teamSource ?? "seed",
        rows: teamYearPlans
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((plan) => projectTierAgainstModels(plan, models)),
      },
      {
        id: "credit-topup",
        title: "积分购买包 · 3 档",
        description: "1000 / 2500 / 6000 分。ppc 约 0.08 / 0.065 / 0.05，不低于至尊 0.04。",
        family: "PERSONAL",
        seats: 1,
        planSource: "seed",
        rows: MARGIN_PROJECTION_TOPUP_PLANS.map((plan) => projectTierAgainstModels(plan, models)),
      },
    ],
  };
}
