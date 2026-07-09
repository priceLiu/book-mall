import { describe, expect, it } from "vitest";

import {
  computeVipCreditScheme,
  computeVipPackageQuote,
  computeVipSeatAllocation,
  validateVipManualAllocation,
  VIP_DEFAULT_COST_GENERAL_YUAN,
  VIP_DEFAULT_COST_VIDEO_YUAN,
  VIP_MIN_AMOUNT_YUAN,
} from "@/lib/finance/vip-package-calculator";

describe("computeVipCreditScheme — 毛利恒定", () => {
  it("按目标毛利分配后实际毛利 ≈ 目标（容差 0.5pct）", () => {
    for (const margin of [0.4, 0.5, 0.6]) {
      for (const f of [0.15, 0.4]) {
        const s = computeVipCreditScheme({
          amountYuan: 200_000,
          targetMargin: margin,
          videoFraction: f,
        });
        expect(Math.abs(s.actualMargin - margin)).toBeLessThan(0.005);
        // 通用 + 视频 = 总积分
        expect(s.generalCredits + s.videoCredits).toBe(s.totalCredits);
        // 视频占比大致等于 f
        expect(Math.abs(s.videoCredits / s.totalCredits - f)).toBeLessThan(0.01);
      }
    }
  });

  it("视频占比越高、同毛利下总积分越少", () => {
    const general = computeVipCreditScheme({ amountYuan: 200_000, targetMargin: 0.5, videoFraction: 0.15 });
    const video = computeVipCreditScheme({ amountYuan: 200_000, targetMargin: 0.5, videoFraction: 0.4 });
    expect(general.totalCredits).toBeGreaterThan(video.totalCredits);
  });

  it("成本口径：视频单位成本 > 通用单位成本（保守）", () => {
    expect(VIP_DEFAULT_COST_VIDEO_YUAN).toBeGreaterThan(VIP_DEFAULT_COST_GENERAL_YUAN);
  });
});

describe("computeVipPackageQuote — 双方案 + 起订", () => {
  it("¥200,000 @ 50% 两方案毛利同为 50%、总积分不同", () => {
    const q = computeVipPackageQuote({ amountYuan: 200_000, targetMargin: 0.5 });
    expect(q.meetsMinimum).toBe(true);
    expect(Math.abs(q.schemeGeneralHeavy.actualMargin - 0.5)).toBeLessThan(0.005);
    expect(Math.abs(q.schemeVideoHeavy.actualMargin - 0.5)).toBeLessThan(0.005);
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
      totalGeneralCredits: 1_000_003,
      totalVideoCredits: 500_002,
      seats: 3,
    });
    expect(alloc.perSeatGeneral * 3 + alloc.remainderGeneral).toBe(1_000_003);
    expect(alloc.perSeatVideo * 3 + alloc.remainderVideo).toBe(500_002);
  });

  it("手动分配合计不等于池总数则拒绝", () => {
    const ok = validateVipManualAllocation({
      totalGeneralCredits: 100,
      totalVideoCredits: 50,
      perSeat: [
        { generalCredits: 60, videoCredits: 30 },
        { generalCredits: 40, videoCredits: 20 },
      ],
    });
    expect(ok.ok).toBe(true);

    const bad = validateVipManualAllocation({
      totalGeneralCredits: 100,
      totalVideoCredits: 50,
      perSeat: [{ generalCredits: 60, videoCredits: 30 }],
    });
    expect(bad.ok).toBe(false);
  });
});
