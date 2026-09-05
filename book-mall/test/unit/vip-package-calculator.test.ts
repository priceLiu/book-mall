import { describe, expect, it } from "vitest";

import {
  buildAutoSeatPlans,
  computeVipCreditScheme,
  computeVipPackageQuote,
  computeVipSeatAllocation,
  validateVipManualAllocation,
  VIP_COST_WORST_PER_CREDIT,
  VIP_DEFAULT_COST_LIGHT_YUAN,
  VIP_MIN_AMOUNT_YUAN,
  VIP_MIN_MARGIN_GUARD,
  VIP_SEEDANCE_CHARGE_CREDITS,
} from "@/lib/finance/vip-package-calculator";

describe("computeVipCreditScheme v2 — 单池 + 毛利护栏", () => {
  it("按目标毛利分配；锚定护栏满足时实际毛利 ≈ 目标", () => {
    for (const margin of [0.4, 0.5, 0.6]) {
      for (const f of [0.15, 0.4]) {
        const s = computeVipCreditScheme({
          amountYuan: 200_000,
          targetMargin: margin,
          videoFraction: f,
        });
        expect(s.anchorMarginOk).toBe(true);
        expect(s.anchorMarginRate).toBeGreaterThanOrEqual(VIP_MIN_MARGIN_GUARD - 0.002);
        // 护栏收紧积分时，按预期用量的实际毛利可能高于目标（仍 ≥ 目标）
        expect(s.actualMargin).toBeGreaterThanOrEqual(margin - 0.02);
        if (s.actualMargin < margin + 0.02) {
          expect(Math.abs(s.actualMargin - margin)).toBeLessThan(0.02);
        }
        expect(s.totalCredits).toBeGreaterThan(0);
      }
    }
  });

  it("锚定 Seedance 15s 毛利 ≥ 护栏（默认 22%）", () => {
    const q = computeVipPackageQuote({ amountYuan: 200_000, targetMargin: 0.5 });
    expect(q.schemeGeneralHeavy.anchorMarginOk).toBe(true);
    expect(q.schemeVideoHeavy.anchorMarginOk).toBe(true);
    expect(q.schemeGeneralHeavy.anchorMarginRate).toBeGreaterThanOrEqual(
      VIP_MIN_MARGIN_GUARD - 0.002,
    );
    expect(q.schemeVideoHeavy.anchorMarginRate).toBeGreaterThanOrEqual(
      VIP_MIN_MARGIN_GUARD - 0.002,
    );
  });

  it("视频用量画像越高、同毛利下总积分越少", () => {
    const balanced = computeVipCreditScheme({
      amountYuan: 200_000,
      targetMargin: 0.5,
      videoFraction: 0.15,
    });
    const videoHeavy = computeVipCreditScheme({
      amountYuan: 200_000,
      targetMargin: 0.5,
      videoFraction: 0.4,
    });
    expect(balanced.totalCredits).toBeGreaterThan(videoHeavy.totalCredits);
  });

  it("最坏单位成本 > 轻量单位成本", () => {
    expect(VIP_COST_WORST_PER_CREDIT).toBeGreaterThan(VIP_DEFAULT_COST_LIGHT_YUAN);
    expect(VIP_COST_WORST_PER_CREDIT * VIP_SEEDANCE_CHARGE_CREDITS).toBe(15);
  });
});

describe("computeVipPackageQuote — 双方案 + 起订", () => {
  it("¥200,000 @ 50% 两方案锚定毛利过护栏、总积分不同", () => {
    const q = computeVipPackageQuote({ amountYuan: 200_000, targetMargin: 0.5 });
    expect(q.meetsMinimum).toBe(true);
    expect(q.schemeGeneralHeavy.anchorMarginOk).toBe(true);
    expect(q.schemeVideoHeavy.anchorMarginOk).toBe(true);
    expect(q.schemeGeneralHeavy.actualMargin).toBeGreaterThanOrEqual(0.48);
    expect(q.schemeVideoHeavy.actualMargin).toBeGreaterThanOrEqual(0.48);
    expect(q.schemeGeneralHeavy.totalCredits).toBeGreaterThan(q.schemeVideoHeavy.totalCredits);
  });

  it("低于起订金额 meetsMinimum=false", () => {
    const q = computeVipPackageQuote({ amountYuan: VIP_MIN_AMOUNT_YUAN - 1 });
    expect(q.meetsMinimum).toBe(false);
  });
});

describe("席位分配守恒", () => {
  it("自动平均分配 + 余数归首席，合计守恒", () => {
    const alloc = computeVipSeatAllocation({
      totalCredits: 1_500_005,
      seats: 3,
    });
    expect(alloc.perSeatCredits * 3 + alloc.remainderCredits).toBe(1_500_005);
  });

  it("buildAutoSeatPlans 与 computeVipSeatAllocation 一致", () => {
    const plans = buildAutoSeatPlans({
      totalCredits: 150,
      seats: 3,
      ownerPhone: "13800138000",
    });
    expect(plans).toHaveLength(3);
    expect(plans[0].phone).toBe("13800138000");
    expect(plans.reduce((s, p) => s + p.credits, 0)).toBe(150);
  });

  it("手动分配合计不等于总数则拒绝", () => {
    const ok = validateVipManualAllocation({
      totalCredits: 150,
      perSeat: [{ credits: 80 }, { credits: 70 }],
    });
    expect(ok.ok).toBe(true);

    const bad = validateVipManualAllocation({
      totalCredits: 150,
      perSeat: [{ credits: 80 }],
    });
    expect(bad.ok).toBe(false);
  });
});
