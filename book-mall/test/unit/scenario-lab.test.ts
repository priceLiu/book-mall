import { describe, expect, it } from "vitest";

import { buildScenarioLabRows, scenarioLabMeta } from "@/lib/billing/scenario-lab";
import { expectedAnchorMarginForM } from "@/lib/pricing/model-margin-policy";

describe("scenario-lab 毛利验算（M=1.0 贵视频 / M=1.5 普通视频）", () => {
  const rows = buildScenarioLabRows();
  const { seedsCount } = scenarioLabMeta();

  it(`个人高级版 ${seedsCount} 行逐模型毛利符合 M 分档`, () => {
    const personalRows = rows.filter((r) => r.scenarioKey === "personal-advanced-month");
    expect(personalRows).toHaveLength(seedsCount);
    for (const row of personalRows) {
      const target = expectedAnchorMarginForM(row.marginM);
      expect(Math.abs(row.marginRate - target)).toBeLessThanOrEqual(0.021);
    }
  });

  it(`团队高级版（4席）${seedsCount} 行逐模型毛利符合 M 分档`, () => {
    const teamRows = rows.filter((r) => r.scenarioKey === "team-advanced-4-seats");
    expect(teamRows).toHaveLength(seedsCount);
    for (const row of teamRows) {
      const target = expectedAnchorMarginForM(row.marginM);
      expect(Math.abs(row.marginRate - target)).toBeLessThanOrEqual(0.021);
    }
  });
});
