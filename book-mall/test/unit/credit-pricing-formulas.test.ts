import { describe, expect, it } from "vitest";

import {
  computeCreditPrice,
  computeEffectiveMargin,
  computePricePerCredit,
  computeTierCredits,
  marginGuardForUnit,
  videoBillableSeconds,
} from "@/lib/pricing/credit-pricing-formulas";
import {
  EXPENSIVE_VIDEO_NET_COST_THRESHOLD,
  resolveModelMarginM,
  VIDEO_MARGIN_M_EXPENSIVE,
  VIDEO_MARGIN_M_NORMAL,
} from "@/lib/pricing/model-margin-policy";

/** happyhorse-r2v：净 0.81/秒，贵视频 M=1.0 → 15s 挂牌 12.15 元 */
const NET_PER_SEC = 0.81;
const VIDEO_SEC = 15;
const VIDEO_COST_YUAN = NET_PER_SEC * VIDEO_SEC;
const VIDEO_LIST_YUAN = VIDEO_COST_YUAN * VIDEO_MARGIN_M_EXPENSIVE;

describe("computeTierCredits — happyhorse 15s（M=1.0 贵视频）", () => {
  const cases: { tier: string; price: number; credits: number; expected: number }[] = [
    { tier: "标准版", price: 69, credits: 1000, expected: 176 },
    { tier: "进阶版", price: 149, credits: 3000, expected: 245 },
    { tier: "高级版", price: 299, credits: 6500, expected: 264 },
    { tier: "豪华版", price: 599, credits: 14000, expected: 284 },
    { tier: "至尊版", price: 1199, credits: 30000, expected: 304 },
    { tier: "团队高级版", price: 1199, credits: 33300, expected: 337 },
    { tier: "团队至尊版", price: 1999, credits: 66600, expected: 405 },
  ];

  for (const c of cases) {
    it(`${c.tier} → ${c.expected} 积分/条`, () => {
      const ppc = computePricePerCredit(c.price, c.credits);
      expect(computeTierCredits(VIDEO_LIST_YUAN, ppc)).toBe(c.expected);
    });
  }

  it("贵视频各档实测毛利 ≈ 0%（贴成本）", () => {
    for (const c of cases) {
      const ppc = computePricePerCredit(c.price, c.credits);
      const credits = computeTierCredits(VIDEO_LIST_YUAN, ppc);
      const margin = computeEffectiveMargin({
        netCostYuan: VIDEO_COST_YUAN,
        creditsPerUnit: credits,
        pricePerCreditYuan: ppc,
      });
      expect(Math.abs(margin)).toBeLessThanOrEqual(0.01);
    }
  });
});

describe("videoBillableSeconds — 15s 封顶", () => {
  it("超 15s 封顶 15", () => expect(videoBillableSeconds(20, 15)).toBe(15));
  it("不足 15s 据实", () => expect(videoBillableSeconds(10, 15)).toBe(10));
  it("缺省时长取封顶", () => expect(videoBillableSeconds(null, 15)).toBe(15));
  it("至少 1s", () => expect(videoBillableSeconds(0, 15)).toBe(1));
});

describe("resolveModelMarginM — 分档系数", () => {
  const guards = { minMarginGuard: 0.3, videoMinMarginGuard: -0.02 };

  it("贵视频 net≥0.75 → M=1.0", () => {
    expect(
      resolveModelMarginM({ unit: "PER_SEC", netCostYuan: EXPENSIVE_VIDEO_NET_COST_THRESHOLD }),
    ).toBe(1.0);
    expect(marginGuardForUnit("PER_SEC", guards)).toBe(-0.02);
  });

  it("普通视频 net<0.75 → M=1.5", () => {
    expect(resolveModelMarginM({ unit: "PER_SEC", netCostYuan: 0.5 })).toBe(VIDEO_MARGIN_M_NORMAL);
  });

  it("贵生图 net≥0.15 → M=1.5", () => {
    expect(resolveModelMarginM({ unit: "PER_IMAGE", netCostYuan: 0.18 })).toBe(1.5);
  });

  it("便宜生图 net<0.15 → M=2.0", () => {
    expect(resolveModelMarginM({ unit: "PER_IMAGE", netCostYuan: 0.072 })).toBe(2.0);
  });
});

describe("computeCreditPrice — happyhorse 单位报价（M=1.0）", () => {
  it("net 0.81 / M=1.0 → 挂牌 0.81、20 积分/秒", () => {
    const r = computeCreditPrice({
      listCostYuan: 0.9,
      discountRate: 0.1,
      marginM: 1.0,
      anchorYuan: 0.04,
    });
    expect(r.netCostYuan).toBeCloseTo(0.81, 6);
    expect(r.listPriceYuan).toBeCloseTo(0.81, 6);
    expect(r.creditsPerUnit).toBe(20);
    expect(r.baseMarginRate).toBeCloseTo(1 - r.netCostYuan / (r.creditsPerUnit * 0.04), 3);
  });
});

describe("computeTierCredits — Seedance 720P 15s（M=1.0）", () => {
  const SEEDANCE_LIST_YUAN = 0.891 * 15;

  it("团队豪华版 → 405 积分/条", () => {
    const ppc = computePricePerCredit(1699, 51500);
    expect(computeTierCredits(SEEDANCE_LIST_YUAN, ppc)).toBe(405);
  });
});

describe("computeCreditPrice — 万相 720P（M=1.5）", () => {
  it("net 0.432 / M=1.5 → 锚定取整后毛利", () => {
    const r = computeCreditPrice({
      listCostYuan: 0.48,
      discountRate: 0.1,
      marginM: 1.5,
      anchorYuan: 0.04,
    });
    expect(r.baseMarginRate).toBeCloseTo(1 - r.netCostYuan / (r.creditsPerUnit * 0.04), 3);
  });
});
