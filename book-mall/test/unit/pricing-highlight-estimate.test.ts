import { describe, expect, it } from "vitest";

import {
  computePricingHighlightEstimate,
  resolveMembershipPeriodCredits,
} from "@/lib/pricing/pricing-highlight-estimate";
import type { PricingHighlightModelPrice } from "@/lib/pricing/pricing-highlight-estimate";
import { SUBSCRIPTION_MONTH_SKUS } from "@/lib/pricing/unified-credit-formula";

const ANCHOR_MODELS: PricingHighlightModelPrice[] = [
  {
    canonicalModelKey: "seedance-2.0-720p-real",
    displayName: "Seedance 2.0 · 720P",
    unit: "PER_SEC",
    creditsPerUnit: 35,
  },
  {
    canonicalModelKey: "wanxiang-image",
    displayName: "通义万相 生图",
    unit: "PER_IMAGE",
    creditsPerUnit: 5,
  },
  {
    canonicalModelKey: "lib-nano-pro-2k",
    displayName: "Nano Pro 2K",
    unit: "PER_IMAGE",
    creditsPerUnit: 1,
  },
];

describe("pricing-highlight-estimate", () => {
  it("年付库内积分为 12 期合计，单期 = ÷12", () => {
    expect(resolveMembershipPeriodCredits(12000, "YEAR")).toBe(1000);
    expect(resolveMembershipPeriodCredits(1000, "MONTH")).toBe(1000);
  });

  it("锚定 Seedance 15s=525、万相 5 积分/张", () => {
    const est = computePricingHighlightEstimate(30000, ANCHOR_MODELS);
    expect(est.videoCreditsPer15s).toBe(525);
    expect(est.imageCreditsPerUnit).toBe(5);
    expect(est.maxImages).toBe(6000);
    expect(est.maxVideos15s).toBe(57);
  });

  it("个人五档月付：视频条数 = floor(积分 ÷ 525)", () => {
    for (const sku of SUBSCRIPTION_MONTH_SKUS) {
      const est = computePricingHighlightEstimate(sku.credits, ANCHOR_MODELS);
      expect(est.maxVideos15s).toBe(Math.floor(sku.credits / 525));
    }
    const std = computePricingHighlightEstimate(1000, ANCHOR_MODELS);
    expect(std.maxVideos15s).toBe(1);
    expect(std.maxImages).toBe(200);
  });
});
