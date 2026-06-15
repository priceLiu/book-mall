import { VIDEO_MODEL_SEEDS } from "@/lib/billing/video-model-seeds";
import { computePricePerCredit, computeTierCredits, DEFAULT_VIDEO_MIN_MARGIN_GUARD, MARGIN_GUARD_TOLERANCE, round4 } from "@/lib/pricing/credit-pricing-formulas";

export const SCENARIO_LAB_USAGE_SECONDS = 15;
export const SCENARIO_LAB_VIDEO_MARGIN_M = 4;
export const SCENARIO_LAB_MARGIN_MIN = DEFAULT_VIDEO_MIN_MARGIN_GUARD - MARGIN_GUARD_TOLERANCE;
export const SCENARIO_LAB_MARGIN_MAX = 0.751;

const PERSONAL_ADVANCED = {
  scenarioKey: "personal-advanced-month",
  scenarioLabel: "个人高级版（月付）",
  priceYuan: 299,
  monthlyCredits: 6500,
};

const TEAM_ADVANCED_4_SEATS = {
  scenarioKey: "team-advanced-4-seats",
  scenarioLabel: "团队高级版（4 席）",
  priceYuan: 289,
  monthlyCredits: 5000,
  seats: 4,
};

export type ScenarioLabScenarioKey =
  | typeof PERSONAL_ADVANCED.scenarioKey
  | typeof TEAM_ADVANCED_4_SEATS.scenarioKey;

export type ScenarioLabRow = {
  scenarioKey: ScenarioLabScenarioKey;
  scenarioLabel: string;
  model: string;
  usageSeconds: number;
  costYuan: number;
  credits: number;
  revenueYuan: number;
  marginRate: number;
};

export type ScenarioLabValidation = {
  ok: boolean;
  range: { min: number; max: number };
  totalRows: number;
  failedRows: number;
};

function simulateRowsForScenario(input: {
  scenarioKey: ScenarioLabScenarioKey;
  scenarioLabel: string;
  priceYuan: number;
  monthlyCredits: number;
}): ScenarioLabRow[] {
  const pricePerCreditYuan = computePricePerCredit(input.priceYuan, input.monthlyCredits);
  return VIDEO_MODEL_SEEDS.map((seed) => {
    const costYuan = round4(seed.listCostYuan * (1 - seed.discountRate) * SCENARIO_LAB_USAGE_SECONDS);
    const listPriceYuan = round4(costYuan * SCENARIO_LAB_VIDEO_MARGIN_M);
    const credits = computeTierCredits(listPriceYuan, pricePerCreditYuan);
    const revenueYuan = round4(credits * pricePerCreditYuan);
    const marginRate = revenueYuan > 0 ? round4(1 - costYuan / revenueYuan) : 0;
    return {
      scenarioKey: input.scenarioKey,
      scenarioLabel: input.scenarioLabel,
      model: seed.canonicalModelKey,
      usageSeconds: SCENARIO_LAB_USAGE_SECONDS,
      costYuan,
      credits,
      revenueYuan,
      marginRate,
    };
  });
}

export function buildScenarioLabRows(): ScenarioLabRow[] {
  return [
    ...simulateRowsForScenario(PERSONAL_ADVANCED),
    ...simulateRowsForScenario(TEAM_ADVANCED_4_SEATS),
  ];
}

export function validateScenarioLabRows(
  rows: ScenarioLabRow[],
  range: { min: number; max: number } = { min: SCENARIO_LAB_MARGIN_MIN, max: SCENARIO_LAB_MARGIN_MAX },
): ScenarioLabValidation {
  let failedRows = 0;
  for (const row of rows) {
    if (row.marginRate < range.min || row.marginRate > range.max) failedRows += 1;
  }
  return {
    ok: failedRows === 0,
    range,
    totalRows: rows.length,
    failedRows,
  };
}

export function scenarioLabMeta() {
  return {
    seedsCount: VIDEO_MODEL_SEEDS.length,
    personal: {
      tier: "高级版",
      period: "MONTH",
      priceYuan: PERSONAL_ADVANCED.priceYuan,
      monthlyCredits: PERSONAL_ADVANCED.monthlyCredits,
    },
    team: {
      tier: "高级版",
      seats: TEAM_ADVANCED_4_SEATS.seats,
      perSeatPriceYuan: TEAM_ADVANCED_4_SEATS.priceYuan,
      perSeatCredits: TEAM_ADVANCED_4_SEATS.monthlyCredits,
    },
  };
}
