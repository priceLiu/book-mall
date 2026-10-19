import { describe, expect, it } from "vitest";

import {
  cstBusinessDate,
  cstDayStartUtc,
  parseCstBusinessDateParam,
} from "@/lib/billing/cst-business-date";

describe("parseCstBusinessDateParam", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(parseCstBusinessDateParam("2026-10-18")).toBe("2026-10-18");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseCstBusinessDateParam("2026-02-30")).toBeNull();
    expect(parseCstBusinessDateParam("not-a-date")).toBeNull();
    expect(parseCstBusinessDateParam("2026/10/18")).toBeNull();
  });

  it("aligns cstDayStartUtc with business date string", () => {
    const d = "2026-10-18";
    const start = cstDayStartUtc(d);
    expect(cstBusinessDate(start)).toBe(d);
  });
});
