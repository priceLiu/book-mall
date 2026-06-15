import { describe, expect, it } from "vitest";

import {
  reverseBreakEven,
  reverseTargetMargin,
  simulatePlanChange,
  simulateRevenue,
  type ModelCostBasis,
  type TierPricing,
} from "@/lib/pricing/pricing-simulation";

/** happyhorse-r2v：净 0.81/秒，贵视频 M=1.0 */
const VIDEO_MODEL: ModelCostBasis = {
  canonicalModelKey: "happyhorse-r2v",
  netCostYuan: 0.81,
  units: 15,
  listPriceYuan: 0.81,
};

const TIERS: TierPricing[] = [
  { tier: "标准版", priceYuan: 69, monthlyCredits: 1000 },
  { tier: "进阶版", priceYuan: 149, monthlyCredits: 3000 },
  { tier: "高级版", priceYuan: 299, monthlyCredits: 6500 },
  { tier: "豪华版", priceYuan: 599, monthlyCredits: 14000 },
  { tier: "至尊版", priceYuan: 1199, monthlyCredits: 30000 },
];

describe("simulatePlanChange — 六维测算（M=1.0 贵视频）", () => {
  const report = simulatePlanChange({ tiers: TIERS, model: VIDEO_MODEL, guard: -0.02 });

  it("单次基础成本 = 12.15", () => {
    expect(report.baseCostYuan).toBeCloseTo(12.15, 4);
  });

  it("各档扣分（贴成本）", () => {
    const byTier = new Map(report.rows.map((r) => [r.tier, r.creditsPerGen]));
    expect(byTier.get("标准版")).toBe(176);
    expect(byTier.get("高级版")).toBe(264);
    expect(byTier.get("至尊版")).toBe(304);
  });

  it("M=1.0 下全档毛利护栏通过（≈0%）", () => {
    expect(report.allPassed).toBe(true);
    expect(Math.abs(report.worstMargin)).toBeLessThanOrEqual(0.01);
  });
});

describe("护栏拦截 — 挂牌低于成本", () => {
  it("worstMargin < 护栏 → allPassed=false", () => {
    const lowMargin: ModelCostBasis = { ...VIDEO_MODEL, listPriceYuan: 0.5 };
    const report = simulatePlanChange({ tiers: TIERS, model: lowMargin, guard: 0 });
    expect(report.allPassed).toBe(false);
    expect(report.worstMargin).toBeLessThan(0);
  });
});

describe("simulateRevenue — 营收模拟", () => {
  it("综合毛利按成本上限保守口径计算", () => {
    const report = simulatePlanChange({ tiers: TIERS, model: VIDEO_MODEL, guard: -0.02 });
    const rev = simulateRevenue({
      report,
      tiers: TIERS,
      scenarios: [
        { tier: "高级版", subscribers: 100 },
        { tier: "至尊版", subscribers: 10 },
      ],
    });
    expect(rev.totalRevenueYuan).toBeCloseTo(299 * 100 + 1199 * 10, 2);
    expect(rev.blendedMargin).toBeGreaterThanOrEqual(0);
  });
});

describe("reverseTargetMargin — 模式 A（目标毛利反推）", () => {
  it("目标 33% → M≈1.5、单位挂牌价 1.215", () => {
    const r = reverseTargetMargin({
      targetMargin: 1 / 3,
      model: { ...VIDEO_MODEL, listPriceYuan: 0.81 },
      tiers: TIERS,
    });
    expect(r.requiredMarginM).toBeCloseTo(1.5, 1);
    expect(r.passed).toBe(true);
  });
});

describe("reverseBreakEven — 模式 B（保本线核验）", () => {
  it("当前扣分（贴成本表）均高于保本线 → safe", () => {
    const r = reverseBreakEven({
      model: VIDEO_MODEL,
      tiers: TIERS,
      currentCreditsByTier: [
        { tier: "标准版", creditsPerGen: 176 },
        { tier: "进阶版", creditsPerGen: 245 },
        { tier: "高级版", creditsPerGen: 264 },
        { tier: "豪华版", creditsPerGen: 284 },
        { tier: "至尊版", creditsPerGen: 304 },
      ],
    });
    expect(r.passed).toBe(true);
    expect(r.breakEven?.every((b) => b.safetyRatio >= 0.995)).toBe(true);
  });

  it("扣分过低 → 触发亏本（unsafe）", () => {
    const r = reverseBreakEven({
      model: VIDEO_MODEL,
      tiers: [{ tier: "标准版", priceYuan: 69, monthlyCredits: 1000 }],
      currentCreditsByTier: [{ tier: "标准版", creditsPerGen: 100 }],
    });
    expect(r.passed).toBe(false);
  });
});
