import { describe, expect, it } from "vitest";

import {
  reverseBreakEven,
  reverseTargetMargin,
  simulatePlanChange,
  simulateRevenue,
  type ModelCostBasis,
  type TierPricing,
} from "@/lib/pricing/pricing-simulation";

const VIDEO_MODEL: ModelCostBasis = {
  canonicalModelKey: "happyhorse-r2v",
  netCostYuan: 0.81,
  units: 15,
  listPriceYuan: 3.24, // 0.81 × 4
};

const TIERS: TierPricing[] = [
  { tier: "标准版", priceYuan: 39, monthlyCredits: 1000 },
  { tier: "进阶版", priceYuan: 99, monthlyCredits: 3000 },
  { tier: "高级版", priceYuan: 199, monthlyCredits: 6500 },
  { tier: "豪华版", priceYuan: 399, monthlyCredits: 14000 },
  { tier: "至尊版", priceYuan: 799, monthlyCredits: 30000 },
];

describe("simulatePlanChange — 六维测算（Phase 4）", () => {
  const report = simulatePlanChange({ tiers: TIERS, model: VIDEO_MODEL, guard: 0.75 });

  it("单次基础成本 = 12.15", () => {
    expect(report.baseCostYuan).toBeCloseTo(12.15, 4);
  });

  it("各档扣分匹配验收表", () => {
    const byTier = new Map(report.rows.map((r) => [r.tier, r.creditsPerGen]));
    expect(byTier.get("标准版")).toBe(1246);
    expect(byTier.get("高级版")).toBe(1587);
    expect(byTier.get("至尊版")).toBe(1825);
  });

  it("M=4 下全档毛利护栏通过（最低毛利 ≈ 75%）", () => {
    expect(report.allPassed).toBe(true);
    expect(report.worstMargin).toBeGreaterThanOrEqual(0.748);
  });
});

describe("护栏拦截 — M 降到 3（毛利 66.7% < 75%）", () => {
  it("worstMargin < 护栏 → allPassed=false", () => {
    const lowMargin: ModelCostBasis = { ...VIDEO_MODEL, listPriceYuan: 0.81 * 3 };
    const report = simulatePlanChange({ tiers: TIERS, model: lowMargin, guard: 0.75 });
    expect(report.allPassed).toBe(false);
    expect(report.worstMargin).toBeLessThan(0.75);
  });
});

describe("simulateRevenue — 营收模拟", () => {
  it("综合毛利按成本上限保守口径计算", () => {
    const report = simulatePlanChange({ tiers: TIERS, model: VIDEO_MODEL, guard: 0.75 });
    const rev = simulateRevenue({
      report,
      tiers: TIERS,
      scenarios: [
        { tier: "高级版", subscribers: 100 },
        { tier: "至尊版", subscribers: 10 },
      ],
    });
    expect(rev.totalRevenueYuan).toBeCloseTo(199 * 100 + 799 * 10, 2);
    expect(rev.blendedMargin).toBeGreaterThan(0);
  });
});

describe("reverseTargetMargin — 模式 A（目标毛利反推）", () => {
  it("目标 75% → M=4、单位挂牌价 3.24", () => {
    const r = reverseTargetMargin({ targetMargin: 0.75, model: VIDEO_MODEL, tiers: TIERS });
    expect(r.requiredMarginM).toBeCloseTo(4, 4);
    expect(r.requiredListPriceYuan).toBeCloseTo(3.24, 4);
    expect(r.passed).toBe(true);
  });
});

describe("reverseBreakEven — 模式 B（保本线核验）", () => {
  it("当前扣分（验收表）均高于保本线 → safe", () => {
    const r = reverseBreakEven({
      model: VIDEO_MODEL,
      tiers: TIERS,
      currentCreditsByTier: [
        { tier: "标准版", creditsPerGen: 1246 },
        { tier: "进阶版", creditsPerGen: 1473 },
        { tier: "高级版", creditsPerGen: 1587 },
        { tier: "豪华版", creditsPerGen: 1705 },
        { tier: "至尊版", creditsPerGen: 1825 },
      ],
    });
    expect(r.passed).toBe(true);
    expect(r.breakEven?.every((b) => b.safetyRatio >= 1)).toBe(true);
  });

  it("扣分过低 → 触发亏本（unsafe）", () => {
    const r = reverseBreakEven({
      model: VIDEO_MODEL,
      tiers: [{ tier: "标准版", priceYuan: 39, monthlyCredits: 1000 }],
      currentCreditsByTier: [{ tier: "标准版", creditsPerGen: 100 }],
    });
    expect(r.passed).toBe(false);
  });
});
