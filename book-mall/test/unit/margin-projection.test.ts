import { describe, expect, it } from "vitest";

import {
  buildMarginProjection,
  creditsPoolForPlan,
  MARGIN_PROJECTION_MODEL_SPECS,
  quoteProjectionModel,
} from "@/lib/billing/margin-projection";

const pricing = { creditAnchorYuan: 0.03, defaultVideoSec: 15 };
const specOf = (id: string) => MARGIN_PROJECTION_MODEL_SPECS.find((s) => s.id === id)!;

describe("margin-projection — 净成本 C 口径（与 docs/成本计算参考文档.md §6 一致）", () => {
  it("先折后加成：C = 挂牌 × (1 − 折扣)，P = C × M，U₀ = P ÷ 0.03", () => {
    const wan = quoteProjectionModel(specOf("wan3.0-video"), pricing, {
      listCostYuan: 0.6,
      discountRate: 0.1,
      source: "cost-profile",
    });
    expect(wan.netCostYuan).toBeCloseTo(0.54, 6);
    expect(wan.listPriceYuan).toBeCloseTo(0.81, 4);
    expect(wan.creditsPerUnit).toBe(27);
    expect(wan.chargeCredits).toBe(405);
    expect(wan.clipCostYuan).toBeCloseTo(8.1, 4);

    const hh = quoteProjectionModel(specOf("happyhorse-1.1"), pricing, {
      listCostYuan: 0.9,
      discountRate: 0.1,
      source: "cost-profile",
    });
    expect(hh.netCostYuan).toBeCloseTo(0.81, 6);
    expect(hh.listPriceYuan).toBeCloseTo(1.215, 4);
    expect(hh.creditsPerUnit).toBe(40.5);
    expect(hh.chargeCredits).toBe(607.5);

    const img = quoteProjectionModel(specOf("gpt-image-2"), pricing, {
      listCostYuan: 0.25,
      discountRate: 0.05,
      source: "cost-profile",
    });
    expect(img.netCostYuan).toBeCloseTo(0.2375, 6);
    expect(img.creditsPerUnit).toBe(11.87);
  });

  it("成本档 marginM 生效", () => {
    const wan = quoteProjectionModel(specOf("wan3.0-video"), pricing, {
      listCostYuan: 0.6,
      discountRate: 0,
      marginM: 1.25,
    });
    expect(wan.marginM).toBe(1.25);
    expect(wan.creditsPerUnit).toBe(25);
  });

  it("已发布报价优先作为一次扣分，并暴露待重新发布差异", () => {
    const wan = quoteProjectionModel(specOf("wan3.0-video"), pricing, {
      listCostYuan: 0.6,
      discountRate: 0.1,
      creditsPerUnit: 30,
      listPriceYuan: 0.9,
      source: "published",
    });
    expect(wan.creditsPerUnit).toBe(30);
    expect(wan.chargeCredits).toBe(450);
    expect(wan.computedCreditsPerUnit).toBe(27);
    expect(wan.clipCostYuan).toBeCloseTo(8.1, 4);
  });
});

describe("margin-projection — 折扣为 0 的种子口径", () => {
  const projection = buildMarginProjection({});
  const personal = projection.dimensions.find((d) => d.id === "personal-month")!;
  const team = projection.dimensions.find((d) => d.id === "team-month-seats")!;
  const modelIndex = Object.fromEntries(projection.models.map((m, i) => [m.id, i]));

  it("个人积分池 = 月积分；团队积分池 = 席位 × 每席积分", () => {
    expect(creditsPoolForPlan({ monthlyCredits: 1000, includedSeats: 1 })).toBe(1000);
    expect(creditsPoolForPlan({ monthlyCredits: 4600, includedSeats: 3 })).toBe(13800);
  });

  it("成本等于挂牌价，不乘折扣", () => {
    const img = projection.models.find((m) => m.id === "gpt-image-2")!;
    const wan = projection.models.find((m) => m.id === "wan3.0-video")!;
    const hh = projection.models.find((m) => m.id === "happyhorse-1.1")!;
    expect(img.netCostYuan).toBe(0.25);
    expect(img.discountRate).toBe(0);
    expect(img.chargeCredits).toBe(12.5);
    expect(wan.netCostYuan).toBe(0.6);
    expect(wan.chargeCredits).toBe(450);
    expect(wan.clipCostYuan).toBeCloseTo(9, 6);
    expect(hh.netCostYuan).toBe(0.9);
    expect(hh.chargeCredits).toBe(675);
    expect(hh.clipCostYuan).toBeCloseTo(13.5, 6);
  });

  it("个人标准档：68 张 / 1 条 Wan / 1 条 HH，毛利均有数", () => {
    const row = personal.rows.find((r) => r.tier === "标准版")!;
    const img = row.cells[modelIndex["gpt-image-2"]!]!;
    const wan = row.cells[modelIndex["wan3.0-video"]!]!;
    const hh = row.cells[modelIndex["happyhorse-1.1"]!]!;
    expect(row.creditsPool).toBe(860);
    expect(personal.rows.find((r) => r.tier === "进阶版")!.creditsPool).toBe(3730);
    expect(personal.rows.find((r) => r.tier === "进阶版")!.priceYuan).toBe(269);
    expect(personal.rows.find((r) => r.tier === "高级版")!.creditsPool).toBe(12050);
    expect(personal.rows.find((r) => r.tier === "高级版")!.priceYuan).toBe(699);
    expect(img.generations).toBe(68);
    expect(img.vendorCostYuan).toBeCloseTo(17, 2);
    expect(img.monthProfitYuan).toBeCloseTo(52, 2);
    expect(wan.generations).toBe(1);
    expect(wan.vendorCostYuan).toBeCloseTo(9, 2);
    expect(wan.monthProfitYuan).toBeCloseTo(60, 2);
    expect(hh.generations).toBe(1);
    expect(hh.vendorCostYuan).toBeCloseTo(13.5, 2);
    expect(hh.monthProfitYuan).toBeCloseTo(55.5, 2);
  });

  it("团队 3 席标准档：597 张 / 16 条 Wan / 11 条 HH", () => {
    expect(team.seats).toBe(3);
    const row = team.rows.find((r) => r.tier === "标准版")!;
    expect(row.creditsPool).toBe(7470);
    expect(row.cells[modelIndex["gpt-image-2"]!]!.generations).toBe(597);
    expect(row.cells[modelIndex["wan3.0-video"]!]!.generations).toBe(16);
    expect(row.cells[modelIndex["happyhorse-1.1"]!]!.generations).toBe(11);
  });

  it("包含读表说明、月/年与积分包维度", () => {
    expect(projection.howToRead.length).toBeGreaterThan(3);
    expect(projection.pricing.costBasis).toBe("net");
    expect(projection.dimensions).toHaveLength(5);
    expect(personal.rows).toHaveLength(4);
    expect(team.rows).toHaveLength(4);
    const year = projection.dimensions.find((d) => d.id === "personal-year")!;
    expect(year.rows).toHaveLength(4);
    expect(year.rows.find((r) => r.tier === "进阶版")!.creditsPool).toBe(44760);
    const packs = projection.dimensions.find((d) => d.id === "credit-topup")!;
    expect(packs.rows.map((r) => r.creditsPool)).toEqual([1000, 2500, 6000]);
    expect(packs.rows[0]!.priceYuan).toBe(80);
    expect(packs.rows[2]!.pricePerCreditYuan).toBeGreaterThanOrEqual(0.05);
  });
});
