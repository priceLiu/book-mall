import { describe, expect, it } from "vitest";

import {
  billableUnitCount,
  computeChargeCredits,
  computeVideoChargeCredits,
} from "@/lib/billing/gateway-credit-settlement";

describe("video billing units", () => {
  const snap = {
    listPriceYuan: 1,
    creditsPerUnit: 25,
    canonicalModelKey: "seedance-2.0-720p-real",
    netCostYuan: 0.5,
    marginRate: 0.33,
    unit: "PER_SEC" as const,
    vendor: "volcengine",
  };

  it("billableUnitCount uses actual seconds capped at 15", () => {
    expect(billableUnitCount("PER_SEC", { durationSec: 5 })).toBe(5);
    expect(billableUnitCount("PER_SEC", { durationSec: 10 })).toBe(10);
    expect(billableUnitCount("PER_SEC", { durationSec: 15 })).toBe(15);
    expect(billableUnitCount("PER_SEC", { durationSec: 20 })).toBe(15);
    expect(billableUnitCount("PER_SEC", { durationSec: null })).toBe(15);
  });

  it("computeVideoChargeCredits scales credits by duration", () => {
    const c5 = computeVideoChargeCredits({
      snapshot: snap,
      durationSec: 5,
      pricePerCreditYuan: 0.04,
    });
    const c15 = computeVideoChargeCredits({
      snapshot: snap,
      durationSec: 15,
      pricePerCreditYuan: 0.04,
    });
    expect(c5.units).toBe(5);
    expect(c15.units).toBe(15);
    expect(c15.credits).toBeGreaterThan(c5.credits);
    expect(c15.credits / c5.credits).toBeCloseTo(3, 0);
  });

  it("computeChargeCredits falls back to creditsPerUnit × units", () => {
    expect(
      computeChargeCredits({
        snapshot: { listPriceYuan: null, creditsPerUnit: 25 },
        units: 5,
        pricePerCreditYuan: null,
      }),
    ).toBe(125);
    expect(
      computeChargeCredits({
        snapshot: { listPriceYuan: null, creditsPerUnit: 25 },
        units: 15,
        pricePerCreditYuan: null,
      }),
    ).toBe(375);
  });
});
