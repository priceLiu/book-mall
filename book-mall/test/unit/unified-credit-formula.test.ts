import { describe, expect, it } from "vitest";

import { FALLBACK_PRICING_CONFIG } from "@/lib/pricing/credit-pricing-formulas";
import {
  buildUnifiedFormulaSimulation,
  computeModelQuoteRow,
  REFERENCE_VENDOR_MODELS,
  SUBSCRIPTION_MONTH_SKUS,
} from "@/lib/pricing/unified-credit-formula";
import { computeUnifiedChargeCredits } from "@/lib/pricing/credit-pricing-formulas";

describe("unified credit formula v2 — Seedance 年框", () => {
  const seedance = REFERENCE_VENDOR_MODELS.find((m) => m.id === "seedance-2.0-720p-real")!;
  const config = { ...FALLBACK_PRICING_CONFIG, videoMinMarginGuard: 0.22 };

  it("公挂牌 1.4 / 年框净 1.0 → M=1.4、15s 扣 525、锚定毛利 28.6%", () => {
    const row = computeModelQuoteRow(seedance, config);
    expect(row.netCostYuan).toBeCloseTo(1.0, 4);
    expect(row.marginM).toBeCloseTo(1.4, 4);
    expect(row.listPriceYuan).toBeCloseTo(1.4, 4);
    expect(row.creditsPerUnit).toBe(35);
    expect(row.chargeCredits15s).toBe(525);
    expect(row.netCost15s).toBeCloseTo(15, 4);
    expect(row.baseMarginRate).toBeCloseTo(1 - 1 / 1.4, 2);
  });

  it("订阅五档 + API 充值在 Seedance 15s 上毛利 ≥ 22%", () => {
    const sim = buildUnifiedFormulaSimulation(config);
    for (const row of [...sim.subscriptionSkus, ...sim.topupSkus, ...sim.apiSkus]) {
      expect(row.marginOk).toBe(true);
      expect(row.marginRate).toBeGreaterThanOrEqual(0.22 - 0.002);
    }
  });

  it("人人扣分相同：各 SKU 表 chargeCredits 一致", () => {
    const sim = buildUnifiedFormulaSimulation(config);
    const charge = sim.subscriptionSkus[0].chargeCredits;
    expect(charge).toBe(525);
    for (const row of [...sim.subscriptionSkus, ...sim.topupSkus, ...sim.apiSkus]) {
      expect(row.chargeCredits).toBe(charge);
    }
  });
});

describe("personal-tier-margins — 五档月付", () => {
  const config = { ...FALLBACK_PRICING_CONFIG, videoMinMarginGuard: 0.22 };
  const sim = buildUnifiedFormulaSimulation(config);

  it("五档 ppc 递减、扣分相同、月内条数随 ppc 变化", () => {
    const rows = sim.subscriptionSkus;
    expect(rows.length).toBe(5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].pricePerCreditYuan).toBeLessThan(rows[i - 1].pricePerCreditYuan);
    }
    const charge = rows[0].chargeCredits;
    for (const row of rows) {
      expect(row.chargeCredits).toBe(charge);
      expect(row.marginOk).toBe(true);
      expect(row.maxGenerations).toBe(Math.floor(row.credits / charge));
    }
  });

  it("标准版 ppc ≈ 0.069", () => {
    const std = sim.subscriptionSkus.find((r) => r.skuId === "personal-标准");
    expect(std?.pricePerCreditYuan).toBeCloseTo(0.069, 3);
  });
});

describe("team-seat-margins — 团队每席 ppc", () => {
  const config = { ...FALLBACK_PRICING_CONFIG, videoMinMarginGuard: 0.22 };
  const anchorCharge = 525;

  const TEAM_SEAT_SKUS = [
    { tier: "标准版", priceYuan: 199, credits: 4600 },
    { tier: "进阶版", priceYuan: 689, credits: 17400 },
    { tier: "高级版", priceYuan: 1199, credits: 33300 },
    { tier: "豪华版", priceYuan: 1699, credits: 51500 },
    { tier: "至尊版", priceYuan: 1999, credits: 66600 },
  ];

  it("每席 ppc 递减、扣分与锚定一致", () => {
    const ppps = TEAM_SEAT_SKUS.map((s) => s.priceYuan / s.credits);
    for (let i = 1; i < ppps.length; i++) {
      expect(ppps[i]).toBeLessThan(ppps[i - 1]);
    }
    for (const sku of TEAM_SEAT_SKUS) {
      const ppc = sku.priceYuan / sku.credits;
      expect(computeUnifiedChargeCredits({ creditsPerUnit: 35, units: 15 })).toBe(anchorCharge);
      expect(ppc).toBeGreaterThan(0);
    }
  });
});

describe("multi-vendor-models", () => {
  const config = { ...FALLBACK_PRICING_CONFIG, videoMinMarginGuard: 0.22 };

  it("参考模型均有 U₀；锚定 Seedance 过护栏", () => {
    for (const model of REFERENCE_VENDOR_MODELS) {
      const row = computeModelQuoteRow(model, config);
      expect(row.creditsPerUnit).toBeGreaterThanOrEqual(1);
      if (model.unit === "PER_SEC") {
        expect(row.chargeCredits15s).toBeGreaterThan(0);
      }
    }
    const seedance = computeModelQuoteRow(
      REFERENCE_VENDOR_MODELS.find((m) => m.id === "seedance-2.0-720p-real")!,
      config,
    );
    expect(seedance.marginOk).toBe(true);
  });

  it("Seedance U₀=35/秒、15s=525", () => {
    const row = computeModelQuoteRow(
      REFERENCE_VENDOR_MODELS.find((m) => m.id === "seedance-2.0-720p-real")!,
      config,
    );
    expect(row.creditsPerUnit).toBe(35);
    expect(row.chargeCredits15s).toBe(525);
  });
});

describe("sku-margin-guard", () => {
  const config = { ...FALLBACK_PRICING_CONFIG, videoMinMarginGuard: 0.22 };
  const sim = buildUnifiedFormulaSimulation(config);

  it("订阅 + App 轻量包 + API 全部 marginOk", () => {
    const all = [...sim.subscriptionSkus, ...sim.topupSkus, ...sim.apiSkus];
    expect(all.every((r) => r.marginOk)).toBe(true);
  });
});
