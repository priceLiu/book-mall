import { describe, expect, it } from "vitest";

import {
  computePricingHighlightEstimate,
  findCheapestHighlightModel,
  resolveMembershipPeriodCredits,
} from "@/lib/pricing/pricing-highlight-estimate";
import type { PricingHighlightModelPrice } from "@/lib/pricing/pricing-highlight-estimate";
import { SUBSCRIPTION_MONTH_SKUS } from "@/lib/pricing/unified-credit-formula";

const CATALOG_MODELS: PricingHighlightModelPrice[] = [
  {
    canonicalModelKey: "seedance-2.0-720p-real",
    displayName: "Seedance 2.0 · 720P 写实",
    unit: "PER_SEC",
    creditsPerUnit: 35,
  },
  {
    canonicalModelKey: "wanxiang-video-2.6",
    displayName: "万相 2.6 图生视频",
    unit: "PER_SEC",
    creditsPerUnit: 12,
  },
  {
    canonicalModelKey: "wan2.7-image",
    displayName: "万相 2.7 生图",
    unit: "PER_IMAGE",
    creditsPerUnit: 8,
  },
  {
    canonicalModelKey: "lib-nano-pro-1k",
    displayName: "Nano Pro 1K",
    unit: "PER_IMAGE",
    creditsPerUnit: 1,
  },
  {
    canonicalModelKey: "aitryon-parsing-v1",
    displayName: "试衣解析",
    unit: "PER_IMAGE",
    creditsPerUnit: 1,
  },
];

describe("pricing-highlight-estimate", () => {
  it("年付库内积分为 12 期合计，单期 = ÷12", () => {
    expect(resolveMembershipPeriodCredits(12000, "YEAR")).toBe(1000);
    expect(resolveMembershipPeriodCredits(1000, "MONTH")).toBe(1000);
  });

  it("排除 Seedance，视频取平台最低价（万相 2.6 · 12 积分/秒 → 15s=180）", () => {
    const video = findCheapestHighlightModel(
      CATALOG_MODELS,
      "PER_SEC",
      /seedance/i,
      ["wanxiang-video-2.6"],
    );
    expect(video?.canonicalModelKey).toBe("wanxiang-video-2.6");

    const est = computePricingHighlightEstimate(1000, CATALOG_MODELS);
    expect(est.videoAnchorLabel).toContain("万相");
    expect(est.videoCreditsPer15s).toBe(180);
    expect(est.maxVideos15s).toBe(5);
  });

  it("生图取最低价 Nano（排除试衣解析），不用万相 2.7", () => {
    const est = computePricingHighlightEstimate(1000, CATALOG_MODELS);
    expect(est.imageAnchorLabel).toContain("Nano");
    expect(est.imageCreditsPerUnit).toBe(1);
    expect(est.maxImages).toBe(1000);
  });

  it("个人五档月付：按低价锚定可生成条数递增", () => {
    const counts = SUBSCRIPTION_MONTH_SKUS.map(
      (sku) => computePricingHighlightEstimate(sku.credits, CATALOG_MODELS).maxVideos15s,
    );
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThan(counts[i - 1]!);
    }
  });
});
