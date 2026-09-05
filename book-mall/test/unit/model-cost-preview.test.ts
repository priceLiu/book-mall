import { describe, expect, it } from "vitest";

import { previewModelCostRow } from "@/lib/finance/model-cost-preview";
import { FALLBACK_PRICING_CONFIG } from "@/lib/pricing/credit-pricing-formulas";

describe("previewModelCostRow", () => {
  it("视频按 M=1.5 换算积分", () => {
    const r = previewModelCostRow(
      {
        canonicalModelKey: "wanxiang-video-2.7",
        unit: "PER_SEC",
        listCostYuan: 0.6,
        discountRate: 0.1,
      },
      FALLBACK_PRICING_CONFIG,
    );
    expect(r.listPriceYuan).toBeCloseTo(0.81, 2);
    expect(r.creditsPerUnit).toBeGreaterThan(0);
    expect(r.marginOk).toBe(true);
    expect(r.mediaKindLabel).toBeTruthy();
  });

  it("同渠道选更低净成本用于发布（排序方向）", () => {
    const profiles = [
      { channel: "CHANNEL", listCostYuan: 0.68, discountRate: 0.05 },
      { channel: "CHANNEL", listCostYuan: 0.6, discountRate: 0.1 },
    ];
    const channelRank: Record<string, number> = { CHANNEL: 0, RESELLER: 1, OWN: 2 };
    const chosen = [...profiles].sort((a, b) => {
      const r = (channelRank[a.channel] ?? 9) - (channelRank[b.channel] ?? 9);
      if (r !== 0) return r;
      const netA = a.listCostYuan * (1 - a.discountRate);
      const netB = b.listCostYuan * (1 - b.discountRate);
      return netA - netB;
    })[0];
    expect(chosen.listCostYuan).toBe(0.6);
  });
});
