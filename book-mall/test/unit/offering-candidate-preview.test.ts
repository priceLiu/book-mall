import { describe, expect, it } from "vitest";

import {
  buildProfileLookup,
  enrichCandidateFromProfile,
  finalizeEnrichedCandidates,
  pickRecommendedCandidateId,
  resolveCostCanonicalKey,
  summarizeOfferingRecommendation,
  type CostProfileLike,
} from "@/lib/platform-model/offering-candidate-preview";
import { FALLBACK_PRICING_CONFIG } from "@/lib/pricing/credit-pricing-formulas";

const CONFIG = FALLBACK_PRICING_CONFIG;

function profile(
  canonicalModelKey: string,
  vendor: string,
  listCostYuan: number,
  discountRate = 0,
): CostProfileLike {
  return {
    canonicalModelKey,
    vendor,
    unit: "PER_SEC",
    listCostYuan,
    discountRate,
    netCostYuan: listCostYuan * (1 - discountRate),
  };
}

describe("resolveCostCanonicalKey", () => {
  it("maps lib-nano-pro to lib-nano-pro-2k", () => {
    expect(resolveCostCanonicalKey("lib-nano-pro")).toBe("lib-nano-pro-2k");
    expect(resolveCostCanonicalKey("seedance-2.0")).toBe("seedance-2.0");
  });
});

describe("pickRecommendedCandidateId", () => {
  it("picks lowest netCost among marginOk candidates", () => {
    const id = pickRecommendedCandidateId([
      { id: "a", marginOk: true, netCostYuan: 0.18, costMissing: false },
      { id: "b", marginOk: true, netCostYuan: 0.125, costMissing: false },
    ]);
    expect(id).toBe("b");
  });

  it("recommends only marginOk vendor when one fails guard", () => {
    const id = pickRecommendedCandidateId([
      { id: "cheap", marginOk: false, netCostYuan: 0.05, costMissing: false },
      { id: "ok", marginOk: true, netCostYuan: 0.5, costMissing: false },
    ]);
    expect(id).toBe("ok");
  });

  it("returns null when all costMissing", () => {
    const id = pickRecommendedCandidateId([
      { id: "a", marginOk: false, netCostYuan: 0, costMissing: true },
      { id: "b", marginOk: false, netCostYuan: 0, costMissing: true },
    ]);
    expect(id).toBeNull();
  });
});

describe("finalizeEnrichedCandidates", () => {
  it("marks recommended and sorts recommended first", () => {
    const out = finalizeEnrichedCandidates([
      {
        id: "volc",
        vendor: "volcengine",
        canonicalModelKey: "seedance-2.0",
        modelKey: "ep-x",
        isActiveRoute: true,
        listCostYuan: 0.18,
        netCostYuan: 0.18,
        unit: "PER_SEC",
        unitLabel: "元/秒",
        creditsPerUnit: 7,
        marginRate: 0.33,
        marginOk: true,
        costMissing: false,
        isRecommended: false,
      },
      {
        id: "kie",
        vendor: "kie",
        canonicalModelKey: "seedance-2.0",
        modelKey: "bytedance/seedance-2",
        isActiveRoute: false,
        listCostYuan: 0.125,
        netCostYuan: 0.125,
        unit: "PER_SEC",
        unitLabel: "元/秒",
        creditsPerUnit: 5,
        marginRate: 0.33,
        marginOk: true,
        costMissing: false,
        isRecommended: false,
      },
    ]);
    expect(out[0]!.id).toBe("kie");
    expect(out[0]!.isRecommended).toBe(true);
    expect(out[1]!.isRecommended).toBe(false);
  });
});

describe("enrichCandidateFromProfile — lib-nano-pro", () => {
  it("uses lib-nano-pro-2k cost profile for lib-nano-pro offering", () => {
    const lookup = buildProfileLookup([
      profile("lib-nano-pro-2k", "kie", 0.06),
    ]);
    const enriched = enrichCandidateFromProfile(
      {
        id: "c1",
        vendor: "kie",
        canonicalModelKey: "lib-nano-pro",
        modelKey: "nano-banana-pro",
        isActiveRoute: false,
      },
      lookup.get("lib-nano-pro-2k|kie"),
      CONFIG,
    );
    expect(enriched.costMissing).toBe(false);
    expect(enriched.listCostYuan).toBe(0.06);
    expect(enriched.netCostYuan).toBe(0.06);
  });

  it("costMissing when no profile for vendor", () => {
    const enriched = enrichCandidateFromProfile(
      {
        id: "c1",
        vendor: "kie",
        canonicalModelKey: "lib-nano-pro",
        modelKey: "nano-banana-pro",
        isActiveRoute: false,
      },
      undefined,
      CONFIG,
    );
    expect(enriched.costMissing).toBe(true);
    expect(enriched.marginOk).toBe(false);
  });
});

describe("summarizeOfferingRecommendation", () => {
  it("detects activeMatchesRecommended", () => {
    const candidates = finalizeEnrichedCandidates([
      {
        id: "kie",
        vendor: "kie",
        canonicalModelKey: "seedance-2.0",
        modelKey: "bytedance/seedance-2",
        isActiveRoute: true,
        listCostYuan: 0.125,
        netCostYuan: 0.125,
        unit: "PER_SEC",
        unitLabel: "元/秒",
        creditsPerUnit: 5,
        marginRate: 0.33,
        marginOk: true,
        costMissing: false,
        isRecommended: false,
      },
      {
        id: "volc",
        vendor: "volcengine",
        canonicalModelKey: "seedance-2.0",
        modelKey: "ep-x",
        isActiveRoute: false,
        listCostYuan: 0.18,
        netCostYuan: 0.18,
        unit: "PER_SEC",
        unitLabel: "元/秒",
        creditsPerUnit: 7,
        marginRate: 0.33,
        marginOk: true,
        costMissing: false,
        isRecommended: false,
      },
    ]);
    const summary = summarizeOfferingRecommendation(candidates);
    expect(summary.recommendedVendor).toBe("kie");
    expect(summary.activeMatchesRecommended).toBe(true);
    expect(summary.activeNetCostYuan).toBe(0.125);
  });
});
