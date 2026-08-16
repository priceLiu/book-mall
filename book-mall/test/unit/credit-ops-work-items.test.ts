import { describe, expect, it } from "vitest";

import { cstBusinessDate, cstDayEndUtc, cstDayStartUtc } from "@/lib/billing/credit-ops-service";

describe("credit-ops CST helpers", () => {
  it("cstBusinessDate from UTC instant", () => {
    // 2026-08-15 20:00 UTC = 2026-08-16 04:00 CST
    expect(cstBusinessDate(new Date("2026-08-15T20:00:00.000Z"))).toBe("2026-08-16");
  });

  it("cstDayStartUtc / cstDayEndUtc span 24h", () => {
    const start = cstDayStartUtc("2026-08-16");
    const end = cstDayEndUtc("2026-08-16");
    expect(start.toISOString()).toBe("2026-08-15T16:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });
});
