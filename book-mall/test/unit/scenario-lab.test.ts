import { describe, expect, it } from "vitest";

import { buildScenarioLabRows, scenarioLabMeta } from "@/lib/billing/scenario-lab";

describe("scenario-lab 毛利验算", () => {
  const rows = buildScenarioLabRows();
  const { seedsCount } = scenarioLabMeta();

  it(`个人高级版 ${seedsCount} 行毛利在 [74.8%, 75.1%]（含 0.2% 容差）`, () => {
    const personalRows = rows.filter((r) => r.scenarioKey === "personal-advanced-month");
    expect(personalRows).toHaveLength(seedsCount);
    for (const row of personalRows) {
      expect(row.marginRate).toBeGreaterThanOrEqual(0.748);
      expect(row.marginRate).toBeLessThanOrEqual(0.751);
    }
  });

  it(`团队高级版（4席）${seedsCount} 行毛利在 [74.8%, 75.1%]（含 0.2% 容差）`, () => {
    const teamRows = rows.filter((r) => r.scenarioKey === "team-advanced-4-seats");
    expect(teamRows).toHaveLength(seedsCount);
    for (const row of teamRows) {
      expect(row.marginRate).toBeGreaterThanOrEqual(0.748);
      expect(row.marginRate).toBeLessThanOrEqual(0.751);
    }
  });
});
