import { describe, expect, it } from "vitest";

import {
  computeCreditPrice,
  computeEffectiveMargin,
  computePricePerCredit,
  computeTierCredits,
  marginGuardForUnit,
  marginMForUnit,
  videoBillableSeconds,
} from "@/lib/pricing/credit-pricing-formulas";

/**
 * 验收基准（docs/财务2.0-验收标准.md §1）：
 * happyhorse-r2v 15s 视频，净成本 0.81 元/秒 → 成本 12.15，M=4 → 挂牌价 48.6。
 */
const NET_PER_SEC = 0.81;
const VIDEO_SEC = 15;
const VIDEO_COST_YUAN = NET_PER_SEC * VIDEO_SEC; // 12.15
const VIDEO_LIST_YUAN = VIDEO_COST_YUAN * 4; // 48.6

describe("computeTierCredits — 逐档积分换算（验收表 §1.1/§1.2）", () => {
  const cases: { tier: string; price: number; credits: number; expected: number }[] = [
    { tier: "标准版", price: 39, credits: 1000, expected: 1246 },
    { tier: "进阶版", price: 99, credits: 3000, expected: 1473 },
    { tier: "高级版", price: 199, credits: 6500, expected: 1587 },
    { tier: "豪华版", price: 399, credits: 14000, expected: 1705 },
    { tier: "至尊版", price: 799, credits: 30000, expected: 1825 },
    { tier: "团队高级版", price: 189, credits: 5000, expected: 1286 },
  ];

  for (const c of cases) {
    it(`${c.tier} → ${c.expected} 积分/条`, () => {
      const ppc = computePricePerCredit(c.price, c.credits);
      expect(computeTierCredits(VIDEO_LIST_YUAN, ppc)).toBe(c.expected);
    });
  }

  it("各档实测毛利 = 75.0% ± 0.1pct", () => {
    for (const c of cases) {
      const ppc = computePricePerCredit(c.price, c.credits);
      const credits = computeTierCredits(VIDEO_LIST_YUAN, ppc);
      const margin = computeEffectiveMargin({
        netCostYuan: VIDEO_COST_YUAN,
        creditsPerUnit: credits,
        pricePerCreditYuan: ppc,
      });
      expect(Math.abs(margin - 0.75)).toBeLessThanOrEqual(0.001);
    }
  });
});

describe("videoBillableSeconds — 15s 封顶", () => {
  it("超 15s 封顶 15", () => expect(videoBillableSeconds(20, 15)).toBe(15));
  it("不足 15s 据实", () => expect(videoBillableSeconds(10, 15)).toBe(10));
  it("缺省时长取封顶", () => expect(videoBillableSeconds(null, 15)).toBe(15));
  it("至少 1s", () => expect(videoBillableSeconds(0, 15)).toBe(1));
});

describe("分类系数与护栏", () => {
  const cfg = { defaultMarginM: 2.5, videoMarginM: 4 };
  const guards = { minMarginGuard: 0.3, videoMinMarginGuard: 0.75 };

  it("视频（PER_SEC）取 M=4 / 护栏 0.75", () => {
    expect(marginMForUnit("PER_SEC", cfg)).toBe(4);
    expect(marginGuardForUnit("PER_SEC", guards)).toBe(0.75);
  });
  it("图像（PER_IMAGE）取默认 M=2.5 / 护栏 0.3", () => {
    expect(marginMForUnit("PER_IMAGE", cfg)).toBe(2.5);
    expect(marginGuardForUnit("PER_IMAGE", guards)).toBe(0.3);
  });
});

describe("computeCreditPrice — happyhorse 单位报价", () => {
  it("net 0.81 / M=4 → 挂牌 3.24、81 积分/秒、毛利 75%", () => {
    const r = computeCreditPrice({ listCostYuan: 0.9, discountRate: 0.1, marginM: 4, anchorYuan: 0.04 });
    expect(r.netCostYuan).toBeCloseTo(0.81, 6);
    expect(r.listPriceYuan).toBeCloseTo(3.24, 6);
    expect(r.creditsPerUnit).toBe(81);
    expect(r.baseMarginRate).toBeCloseTo(0.75, 4);
  });
});
