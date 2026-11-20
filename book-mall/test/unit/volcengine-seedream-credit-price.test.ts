import { describe, expect, it } from "vitest";

import {
  computeBaseMarginRate,
  computeCreditsPerUnit,
  computeListPrice,
  computeNetCost,
  DEFAULT_CREDIT_ANCHOR_YUAN,
} from "@/lib/pricing/credit-pricing-formulas";
import { resolveModelMarginM } from "@/lib/pricing/model-margin-policy";

const VOLC_DISCOUNT = 0.08;
const IMAGE_M = resolveModelMarginM({ unit: "PER_IMAGE", netCostYuan: 0.1 });

/** 方舟 model-pricing 挂牌 + 平台公式（M=1.5，anchor ¥0.03/积分，渠道折扣 8%） */
function expectedCredits(listCostYuan: number): number {
  const net = computeNetCost(listCostYuan, VOLC_DISCOUNT);
  const listPrice = computeListPrice(net, IMAGE_M);
  return computeCreditsPerUnit(listPrice, DEFAULT_CREDIT_ANCHOR_YUAN);
}

describe("volcengine seedream · 挂牌价→积分（对齐方舟 model-pricing）", () => {
  it("5.0 lite 输出 ¥0.22/张", () => {
    expect(expectedCredits(0.22)).toBe(10.12);
  });

  it("5.0 pro · P≤2.61M ¥0.30/张", () => {
    expect(expectedCredits(0.3)).toBe(13.8);
  });

  it("5.0 pro · P>2.61M ¥0.60/张", () => {
    expect(expectedCredits(0.6)).toBe(27.6);
  });

  it("5.5 · P≤2.61M ¥0.13/张", () => {
    expect(expectedCredits(0.13)).toBe(5.98);
  });

  it("5.5 · 2.61M<P≤4.63M ¥0.23/张", () => {
    expect(expectedCredits(0.23)).toBe(10.58);
  });

  it("毛利率护栏：锚定口径应约 33%（1 − 1/M）", () => {
    const net = computeNetCost(0.3, VOLC_DISCOUNT);
    const u = expectedCredits(0.3);
    const g = computeBaseMarginRate(net, u, DEFAULT_CREDIT_ANCHOR_YUAN);
    expect(g).toBeGreaterThanOrEqual(0.32);
    expect(g).toBeLessThanOrEqual(0.34);
  });
});