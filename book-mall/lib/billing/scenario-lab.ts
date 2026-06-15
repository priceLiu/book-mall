import { VIDEO_MODEL_SEEDS } from "@/lib/billing/video-model-seeds";
import {
  computePricePerCredit,
  computeTierCredits,
  MARGIN_GUARD_TOLERANCE,
  round4,
} from "@/lib/pricing/credit-pricing-formulas";
import {
  expectedAnchorMarginForM,
  resolveModelMarginM,
} from "@/lib/pricing/model-margin-policy";

export const SCENARIO_LAB_USAGE_SECONDS = 15;

const PERSONAL_ADVANCED = {
  scenarioKey: "personal-advanced-month",
  scenarioLabel: "个人高级版（月付）",
  priceYuan: 299,
  monthlyCredits: 6500,
};

const TEAM_ADVANCED_4_SEATS = {
  scenarioKey: "team-advanced-4-seats",
  scenarioLabel: "团队高级版（4 席）",
  priceYuan: 1199,
  monthlyCredits: 33300,
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
  marginM: number;
};

export type ScenarioLabValidation = {
  ok: boolean;
  totalRows: number;
  failedRows: number;
};

function expectedMarginRange(marginM: number): { min: number; max: number } {
  const target = expectedAnchorMarginForM(marginM);
  const tol = 0.02 + MARGIN_GUARD_TOLERANCE;
  return { min: target - tol, max: target + tol };
}

/** 按模型 M 分档的预期毛利区间（Scenario Lab / 财务说明用）。 */
export function scenarioLabExpectedMarginRange(marginM: number): {
  min: number;
  max: number;
} {
  return expectedMarginRange(marginM);
}

function simulateRowsForScenario(input: {
  scenarioKey: ScenarioLabScenarioKey;
  scenarioLabel: string;
  priceYuan: number;
  monthlyCredits: number;
}): ScenarioLabRow[] {
  const pricePerCreditYuan = computePricePerCredit(input.priceYuan, input.monthlyCredits);
  return VIDEO_MODEL_SEEDS.map((seed) => {
    const netPerSec = seed.listCostYuan * (1 - seed.discountRate);
    const costYuan = round4(netPerSec * SCENARIO_LAB_USAGE_SECONDS);
    const marginM = resolveModelMarginM({ unit: "PER_SEC", netCostYuan: netPerSec });
    const listPriceYuan = round4(costYuan * marginM);
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
      marginM,
    };
  });
}

export function buildScenarioLabRows(): ScenarioLabRow[] {
  return [
    ...simulateRowsForScenario(PERSONAL_ADVANCED),
    ...simulateRowsForScenario(TEAM_ADVANCED_4_SEATS),
  ];
}

export function validateScenarioLabRows(rows: ScenarioLabRow[]): ScenarioLabValidation {
  let failedRows = 0;
  for (const row of rows) {
    const { min, max } = expectedMarginRange(row.marginM);
    if (row.marginRate < min || row.marginRate > max) failedRows += 1;
  }
  return {
    ok: failedRows === 0,
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
