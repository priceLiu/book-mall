import { describe, expect, it } from "vitest";

import {
  computeChargeCreditsFromSnapshot,
  computeCreditPrice,
  computeEffectiveMargin,
  computePricePerCredit,
  computeUnifiedChargeCredits,
  marginGuardForUnit,
  videoBillableSeconds,
} from "@/lib/pricing/credit-pricing-formulas";
import {
  EXPENSIVE_VIDEO_NET_COST_THRESHOLD,
  resolveModelMarginM,
  VIDEO_MARGIN_M_NORMAL,
  VIDEO_PUBLIC_ALIGN_MIN_M,
} from "@/lib/pricing/model-margin-policy";

describe("computeUnifiedChargeCredits — 人人相同扣分", () => {
  it("高级版 ppc 与标准版 ppc 扣分相同", () => {
    const creditsPerUnit = 35;
    const units = 15;
    const u = computeUnifiedChargeCredits({ creditsPerUnit, units });
    expect(u).toBe(525);
    expect(
      computeChargeCreditsFromSnapshot({
        creditsPerUnit,
        units,
        pricePerCreditYuan: 0.069,
      }),
    ).toBe(u);
    expect(
      computeChargeCreditsFromSnapshot({
        creditsPerUnit,
        units,
        pricePerCreditYuan: 0.04,
      }),
    ).toBe(u);
  });
});

describe("videoBillableSeconds — 15s 封顶", () => {
  it("超 15s 封顶 15", () => expect(videoBillableSeconds(20, 15)).toBe(15));
  it("不足 15s 据实", () => expect(videoBillableSeconds(10, 15)).toBe(10));
  it("缺省时长取封顶", () => expect(videoBillableSeconds(null, 15)).toBe(15));
});

describe("resolveModelMarginM — 公挂牌对齐", () => {
  const guards = { minMarginGuard: 0.3, videoMinMarginGuard: 0.22 };

  it("Seedance 1.4/1.0 → M=1.4", () => {
    expect(
      resolveModelMarginM({
        unit: "PER_SEC",
        netCostYuan: 1.0,
        listCostYuan: 1.4,
      }),
    ).toBe(1.4);
    expect(marginGuardForUnit("PER_SEC", guards)).toBe(0.22);
  });

  it("贵视频 net≥0.75 且 list/C<1.25 → M=1.25", () => {
    expect(
      resolveModelMarginM({
        unit: "PER_SEC",
        netCostYuan: EXPENSIVE_VIDEO_NET_COST_THRESHOLD,
        listCostYuan: 0.9,
      }),
    ).toBe(VIDEO_PUBLIC_ALIGN_MIN_M);
  });

  it("普通视频 net<0.75 → M=1.5", () => {
    expect(resolveModelMarginM({ unit: "PER_SEC", netCostYuan: 0.5 })).toBe(VIDEO_MARGIN_M_NORMAL);
  });
});

describe("computeCreditPrice — Seedance 单秒", () => {
  it("net 1.0 / M=1.4 → 挂牌 1.4、35 积分/秒", () => {
    const r = computeCreditPrice({
      listCostYuan: 1.4,
      discountRate: 0.2857,
      marginM: 1.4,
      anchorYuan: 0.04,
    });
    expect(r.netCostYuan).toBeCloseTo(1.0, 3);
    expect(r.listPriceYuan).toBeCloseTo(1.4, 4);
    expect(r.creditsPerUnit).toBe(35);
    expect(r.baseMarginRate).toBeCloseTo(1 - 1 / 1.4, 2);
  });
});

describe("computeEffectiveMargin — 高级版 Seedance 15s", () => {
  it("ppc=0.046、525 分、成本 15 → 毛利约 38%", () => {
    const ppc = computePricePerCredit(299, 6500);
    const margin = computeEffectiveMargin({
      netCostYuan: 15,
      creditsPerUnit: 525,
      pricePerCreditYuan: ppc,
    });
    expect(margin).toBeGreaterThan(0.3);
    expect(margin).toBeLessThan(0.45);
  });
});
