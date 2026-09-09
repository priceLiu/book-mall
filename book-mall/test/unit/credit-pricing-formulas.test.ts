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
  IMAGE_MARGIN_M_NORMAL,
  resolveModelMarginM,
  VIDEO_MARGIN_M_NORMAL,
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

describe("resolveModelMarginM — 类型分档（v3）", () => {
  it("视频 → M=1.5", () => {
    expect(resolveModelMarginM({ unit: "PER_SEC", netCostYuan: 1.0 })).toBe(VIDEO_MARGIN_M_NORMAL);
  });

  it("图片 → M=1.5", () => {
    expect(resolveModelMarginM({ unit: "PER_IMAGE", netCostYuan: 0.2 })).toBe(IMAGE_MARGIN_M_NORMAL);
  });

  it("文本 → M=1.0（不加价）", () => {
    expect(resolveModelMarginM({ unit: "PER_KTOKEN", netCostYuan: 0.002 })).toBe(1.0);
  });

  it("模型配置 marginM 优先", () => {
    expect(resolveModelMarginM({ unit: "PER_SEC", netCostYuan: 1.0, marginM: 2.0 })).toBe(2.0);
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
