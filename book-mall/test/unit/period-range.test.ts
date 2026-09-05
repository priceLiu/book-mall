import { describe, expect, it } from "vitest";

import {
  dateInPeriod,
  detectPeriodFromDates,
  monthKeyOverlapsPeriod,
  periodFromMonthKey,
  periodKey,
  resolvePeriod,
} from "@/lib/finance/reconciliation-v2/period-range";

describe("period-range", () => {
  it("builds periodKey", () => {
    expect(periodKey({ from: "2026-07-24", to: "2026-08-22" })).toBe(
      "20260724_20260822",
    );
  });

  it("detects period from dates", () => {
    expect(
      detectPeriodFromDates(["2026-08-21", "2026-07-24", "2026-08-01"]),
    ).toEqual({ from: "2026-07-24", to: "2026-08-21" });
  });

  it("dateInPeriod inclusive", () => {
    const p = { from: "2026-07-24", to: "2026-08-22" };
    expect(dateInPeriod("2026-07-24", p)).toBe(true);
    expect(dateInPeriod("2026-08-22", p)).toBe(true);
    expect(dateInPeriod("2026-07-23", p)).toBe(false);
  });

  it("month overlaps period", () => {
    const p = { from: "2026-07-24", to: "2026-08-22" };
    expect(monthKeyOverlapsPeriod("202607", p)).toBe(true);
    expect(monthKeyOverlapsPeriod("202608", p)).toBe(true);
    expect(monthKeyOverlapsPeriod("202606", p)).toBe(false);
  });

  it("resolve from YYYYMM month", () => {
    const p = resolvePeriod({ month: "202608" });
    expect(p.from).toBe("2026-08-01");
    expect(p.to).toBe("2026-08-31");
  });

  it("periodFromMonthKey last day", () => {
    expect(periodFromMonthKey("202608").to).toBe("2026-08-31");
  });
});
