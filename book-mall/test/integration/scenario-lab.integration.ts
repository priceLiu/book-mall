/**
 * 财务 2.0 — scenario-lab 集成脚本（mock settle 个人 + 团队各 30 次）。
 *
 * 运行：
 *   tsx test/integration/scenario-lab.integration.ts
 */
import {
  buildScenarioLabRows,
  SCENARIO_LAB_MARGIN_MAX,
  SCENARIO_LAB_MARGIN_MIN,
  validateScenarioLabRows,
} from "@/lib/billing/scenario-lab";

type MockSettleInput = {
  scenarioKey: string;
  model: string;
  credits: number;
  costYuan: number;
  revenueYuan: number;
  marginRate: number;
};

let settleCalls = 0;
let settleCredits = 0;
let settleCostYuan = 0;
let settleRevenueYuan = 0;

function mockSettle(input: MockSettleInput) {
  settleCalls += 1;
  settleCredits += input.credits;
  settleCostYuan += input.costYuan;
  settleRevenueYuan += input.revenueYuan;
}

function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`, extra ?? "");
    process.exitCode = 1;
  }
}

function runScenarioBlock(
  label: string,
  scenarioKey: "personal-advanced-month" | "team-advanced-4-seats",
  rows: ReturnType<typeof buildScenarioLabRows>,
) {
  const scenarioRows = rows.filter((r) => r.scenarioKey === scenarioKey);
  check(`${label} 行数 = 30`, scenarioRows.length === 30, { len: scenarioRows.length });

  for (const row of scenarioRows) {
    check(
      `${label} · ${row.model} 毛利 ∈ [${(SCENARIO_LAB_MARGIN_MIN * 100).toFixed(1)}%, ${(SCENARIO_LAB_MARGIN_MAX * 100).toFixed(1)}%]`,
      row.marginRate >= SCENARIO_LAB_MARGIN_MIN && row.marginRate <= SCENARIO_LAB_MARGIN_MAX,
      { marginRate: row.marginRate, model: row.model },
    );
    mockSettle({
      scenarioKey: row.scenarioKey,
      model: row.model,
      credits: row.credits,
      costYuan: row.costYuan,
      revenueYuan: row.revenueYuan,
      marginRate: row.marginRate,
    });
  }
}

function main() {
  const rows = buildScenarioLabRows();
  const validation = validateScenarioLabRows(rows);
  check("全量校验通过", validation.ok, validation);

  const callsBefore = settleCalls;
  runScenarioBlock("个人高级版", "personal-advanced-month", rows);
  const personalCalls = settleCalls - callsBefore;
  check("个人 mock settle 30 次", personalCalls === 30, { personalCalls });

  const teamCallsBefore = settleCalls;
  runScenarioBlock("团队高级版（4 席）", "team-advanced-4-seats", rows);
  const teamCalls = settleCalls - teamCallsBefore;
  check("团队 mock settle 30 次", teamCalls === 30, { teamCalls });

  check("合计 mock settle 60 次", settleCalls === 60, { settleCalls });
  check("累计积分 > 0", settleCredits > 0, { settleCredits });
  check("累计收入 > 累计成本", settleRevenueYuan > settleCostYuan, {
    settleRevenueYuan,
    settleCostYuan,
  });

  if (!process.exitCode) {
    console.log("✅ scenario-lab integration checks passed");
  }
}

main();
