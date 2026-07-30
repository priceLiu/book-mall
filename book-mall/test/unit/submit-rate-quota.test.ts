import { describe, expect, it } from "vitest";
import {
  burstLimitForTier,
  SUBMIT_BURST_ELEVATED,
  SUBMIT_BURST_HEAVY_DEFAULT,
  SUBMIT_BURST_STANDARD,
} from "@/lib/generation/submit-rate/constants";
import { resolveSubmitQuotaFromSource } from "@/lib/generation/submit-rate/resolve-submit-quota";

describe("resolve-submit-quota", () => {
  it("STANDARD tier uses 10", () => {
    const r = resolveSubmitQuotaFromSource({ tier: "STANDARD" });
    expect(r.tier).toBe("STANDARD");
    expect(r.burstLimit).toBe(SUBMIT_BURST_STANDARD);
  });

  it("ELEVATED tier uses 15", () => {
    const r = resolveSubmitQuotaFromSource({ tier: "ELEVATED" });
    expect(r.burstLimit).toBe(SUBMIT_BURST_ELEVATED);
  });

  it("HEAVY without override defaults to 25", () => {
    const r = resolveSubmitQuotaFromSource({ tier: "HEAVY" });
    expect(r.burstLimit).toBe(SUBMIT_BURST_HEAVY_DEFAULT);
  });

  it("HEAVY respects burst override", () => {
    const r = resolveSubmitQuotaFromSource({ tier: "HEAVY", burstOverride: 40 });
    expect(r.burstLimit).toBe(40);
  });

  it("ADMIN without tier gets ELEVATED 15", () => {
    const r = resolveSubmitQuotaFromSource({ userRole: "ADMIN" });
    expect(r.tier).toBe("ELEVATED");
    expect(r.burstLimit).toBe(SUBMIT_BURST_ELEVATED);
  });

  it("SUPER_ADMIN without tier gets ELEVATED 15", () => {
    const r = resolveSubmitQuotaFromSource({ userRole: "SUPER_ADMIN" });
    expect(r.tier).toBe("ELEVATED");
    expect(r.burstLimit).toBe(SUBMIT_BURST_ELEVATED);
  });

  it("regular USER without tier gets STANDARD 10", () => {
    const r = resolveSubmitQuotaFromSource({ userRole: "USER" });
    expect(r.tier).toBe("STANDARD");
    expect(r.burstLimit).toBe(SUBMIT_BURST_STANDARD);
  });

  it("explicit tier overrides admin default", () => {
    const r = resolveSubmitQuotaFromSource({ tier: "HEAVY", userRole: "ADMIN" });
    expect(r.tier).toBe("HEAVY");
    expect(r.burstLimit).toBe(SUBMIT_BURST_HEAVY_DEFAULT);
  });
});

describe("burstLimitForTier", () => {
  it("maps all tiers", () => {
    expect(burstLimitForTier("STANDARD")).toBe(10);
    expect(burstLimitForTier("ELEVATED")).toBe(15);
    expect(burstLimitForTier("HEAVY")).toBe(25);
    expect(burstLimitForTier("HEAVY", 99)).toBe(99);
  });
});
