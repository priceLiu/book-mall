import {
  buildScenarioLabRows,
  SCENARIO_LAB_USAGE_SECONDS,
  scenarioLabMeta,
  validateScenarioLabRows,
} from "@/lib/billing/scenario-lab";
import { deriveVideoMonthlyCredits } from "@/lib/billing/video-model-seeds";
import { computePricePerCredit, round4 } from "@/lib/pricing/credit-pricing-formulas";

const BENCHMARK_MODEL = "happyhorse-r2v";
const BENCHMARK_LABEL = "HappyHorse 参考图生视频（15 秒，验收基准模型）";

export type UsageSnapshot = {
  label: string;
  description: string;
  videosCount: number;
  creditsUsed: number;
  vendorCostYuan: number;
  revenueYuan: number;
  profitYuan: number;
  marginRate: number;
  creditsRemaining?: number;
};

export type BusinessScenario = {
  key: "personal-advanced-month" | "team-advanced-4-seats";
  audience: string;
  tierLabel: string;
  subscription: {
    monthlyPriceYuan: number;
    monthlyCredits: number;
    videoPoolCredits: number;
    pricePerCreditYuan: number;
    seats?: number;
    totalTeamPriceYuan?: number;
    totalTeamCredits?: number;
  };
  singleVideo: {
    model: string;
    modelLabel: string;
    durationSeconds: number;
    creditsCharged: number;
    vendorCostYuan: number;
    revenueYuan: number;
    profitYuan: number;
    marginRate: number;
  };
  daily: UsageSnapshot[];
  monthly: UsageSnapshot[];
};

export type FinanceBusinessScenariosPayload = {
  intro: string;
  benchmarkNote: string;
  validation: {
    ok: boolean;
    modelCount: number;
    marginRange: { minPct: number; maxPct: number };
  };
  scenarios: BusinessScenario[];
  glossary: { term: string; meaning: string }[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function usageFromVideos(input: {
  label: string;
  description: string;
  videosCount: number;
  creditsPerVideo: number;
  costPerVideo: number;
  pricePerCreditYuan: number;
  creditBudget?: number;
}): UsageSnapshot {
  const videosCount = input.videosCount;
  const creditsUsed = videosCount * input.creditsPerVideo;
  const vendorCostYuan = round2(videosCount * input.costPerVideo);
  const revenueYuan = round2(creditsUsed * input.pricePerCreditYuan);
  const profitYuan = round2(revenueYuan - vendorCostYuan);
  const marginRate = revenueYuan > 0 ? round4(profitYuan / revenueYuan) : 0;
  const creditsRemaining =
    input.creditBudget != null ? Math.max(0, input.creditBudget - creditsUsed) : undefined;
  return {
    label: input.label,
    description: input.description,
    videosCount,
    creditsUsed,
    vendorCostYuan,
    revenueYuan,
    profitYuan,
    marginRate,
    creditsRemaining,
  };
}

function buildScenario(input: {
  key: BusinessScenario["key"];
  audience: string;
  tierLabel: string;
  monthlyPriceYuan: number;
  monthlyCredits: number;
  seats?: number;
  benchmarkRow: {
    credits: number;
    costYuan: number;
    revenueYuan: number;
    marginRate: number;
  };
}): BusinessScenario {
  const pricePerCreditYuan = computePricePerCredit(input.monthlyPriceYuan, input.monthlyCredits);
  const videoPoolCredits = deriveVideoMonthlyCredits(input.monthlyCredits);
  const seats = input.seats ?? 1;
  const totalTeamCredits = input.monthlyCredits * seats;
  const totalTeamPriceYuan = input.monthlyPriceYuan * seats;
  const creditBudget = seats > 1 ? totalTeamCredits : input.monthlyCredits;

  const single = input.benchmarkRow;
  const profitYuan = round2(single.revenueYuan - single.costYuan);

  const dailyCounts = [1, 3, 5];
  const daily = dailyCounts.map((n) =>
    usageFromVideos({
      label: `${n} 条/天`,
      description: `假设${seats > 1 ? "团队" : "用户"}每天生成 ${n} 条 ${BENCHMARK_LABEL}`,
      videosCount: n,
      creditsPerVideo: single.credits,
      costPerVideo: single.costYuan,
      pricePerCreditYuan,
    }),
  );

  const maxVideosInMonth = Math.floor(creditBudget / single.credits);
  const monthly: UsageSnapshot[] = [
    {
      label: "月付入账（尚未消耗）",
      description: `用户本月支付 ¥${input.monthlyPriceYuan}${seats > 1 ? `/席 × ${seats} 席` : ""}，积分尚未使用`,
      videosCount: 0,
      creditsUsed: 0,
      vendorCostYuan: 0,
      revenueYuan: round2(seats > 1 ? totalTeamPriceYuan : input.monthlyPriceYuan),
      profitYuan: round2(seats > 1 ? totalTeamPriceYuan : input.monthlyPriceYuan),
      marginRate: 1,
      creditsRemaining: creditBudget,
    },
    usageFromVideos({
      label: "轻度：约 10 条/月",
      description: seats > 1 ? "团队合计约 10 条视频" : "适合偶尔出片的个人创作者",
      videosCount: 10,
      creditsPerVideo: single.credits,
      costPerVideo: single.costYuan,
      pricePerCreditYuan,
      creditBudget,
    }),
    usageFromVideos({
      label: "中度：约 20 条/月",
      description: seats > 1 ? "团队合计约 20 条视频" : "稳定产出，接近套餐上限的一半",
      videosCount: 20,
      creditsPerVideo: single.credits,
      costPerVideo: single.costYuan,
      pricePerCreditYuan,
      creditBudget,
    }),
    usageFromVideos({
      label: `重度：月积分可支撑约 ${maxVideosInMonth} 条`,
      description: `在基准模型下，${seats > 1 ? "团队合计" : "个人"}月积分约可生成 ${maxVideosInMonth} 条 15s 视频`,
      videosCount: maxVideosInMonth,
      creditsPerVideo: single.credits,
      costPerVideo: single.costYuan,
      pricePerCreditYuan,
      creditBudget,
    }),
  ];

  return {
    key: input.key,
    audience: input.audience,
    tierLabel: input.tierLabel,
    subscription: {
      monthlyPriceYuan: input.monthlyPriceYuan,
      monthlyCredits: input.monthlyCredits,
      videoPoolCredits: seats > 1 ? deriveVideoMonthlyCredits(input.monthlyCredits) : videoPoolCredits,
      pricePerCreditYuan: round4(pricePerCreditYuan),
      seats: seats > 1 ? seats : undefined,
      totalTeamPriceYuan: seats > 1 ? totalTeamPriceYuan : undefined,
      totalTeamCredits: seats > 1 ? totalTeamCredits : undefined,
    },
    singleVideo: {
      model: BENCHMARK_MODEL,
      modelLabel: BENCHMARK_LABEL,
      durationSeconds: SCENARIO_LAB_USAGE_SECONDS,
      creditsCharged: single.credits,
      vendorCostYuan: single.costYuan,
      revenueYuan: single.revenueYuan,
      profitYuan,
      marginRate: single.marginRate,
    },
    daily,
    monthly,
  };
}

export function buildFinanceBusinessScenarios(): FinanceBusinessScenariosPayload {
  const rows = buildScenarioLabRows();
  const validation = validateScenarioLabRows(rows);
  const meta = scenarioLabMeta();

  const personalBench = rows.find(
    (r) => r.scenarioKey === "personal-advanced-month" && r.model === BENCHMARK_MODEL,
  )!;
  const teamBench = rows.find(
    (r) => r.scenarioKey === "team-advanced-4-seats" && r.model === BENCHMARK_MODEL,
  )!;

  const scenarios: BusinessScenario[] = [
    buildScenario({
      key: "personal-advanced-month",
      audience: "个人用户",
      tierLabel: "高级版 · 月付",
      monthlyPriceYuan: meta.personal.priceYuan,
      monthlyCredits: meta.personal.monthlyCredits,
      benchmarkRow: personalBench,
    }),
    buildScenario({
      key: "team-advanced-4-seats",
      audience: "团队用户",
      tierLabel: "高级版 · 4 席团队",
      monthlyPriceYuan: meta.team.perSeatPriceYuan,
      monthlyCredits: meta.team.perSeatCredits,
      seats: meta.team.seats ?? 4,
      benchmarkRow: teamBench,
    }),
  ];

  return {
    intro:
      "用「用户付多少钱 → 消耗多少积分 → 我们付厂商多少成本 → 确认多少收入 → 剩多少利润」帮财务同事快速看懂个人与团队套餐的经济账。",
    benchmarkNote:
      "以下数字以验收基准模型 happyhorse-r2v、15 秒视频、M=4（目标毛利 75%）核算；不同模型扣分与成本略有差异，完整 30 模型明细见 Scenario Lab。",
    validation: {
      ok: validation.ok,
      modelCount: meta.seedsCount,
      marginRange: {
        minPct: round2(validation.range.min * 100),
        maxPct: round2(validation.range.max * 100),
      },
    },
    scenarios,
    glossary: [
      { term: "月付 / 团队月付", meaning: "用户当月向我们支付的套餐费用（订阅收入）。" },
      { term: "月积分", meaning: "套餐内含积分总量；视频默认走视频专用池（约为月积分 20%）。" },
      { term: "单条扣分", meaning: "生成 1 条 15s 视频从用户账户冻结并结算的积分数。" },
      { term: "厂商成本", meaning: "我们付给云厂商（阿里/火山等）的实际成本，含渠道折扣。" },
      { term: "确认收入", meaning: "积分消耗时，按「扣分 × 该用户积分单价」折算的已确认收入。" },
      { term: "利润", meaning: "确认收入 − 厂商成本；毛利率 = 利润 ÷ 确认收入。" },
      { term: "按日测算", meaning: "假设用户每天固定生成 N 条基准视频时的当日积分、成本与利润。" },
      { term: "按月测算", meaning: "整月视角：从月付入账到不同使用量（10/20/用满）下的汇总。" },
    ],
  };
}
