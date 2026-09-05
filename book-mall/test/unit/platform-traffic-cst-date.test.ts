import { describe, expect, it } from "vitest";

import { cstDateKey, lastNCstDateKeys } from "@/lib/site-traffic/cst-date";

describe("cstDateKey", () => {
  it("uses UTC+8 calendar day", () => {
    // 2026-08-21 15:00 UTC = 2026-08-21 23:00 CST
    expect(cstDateKey(new Date("2026-08-21T15:00:00.000Z"))).toBe("2026-08-21");
    // 2026-08-21 16:00 UTC = 2026-08-22 00:00 CST
    expect(cstDateKey(new Date("2026-08-21T16:00:00.000Z"))).toBe("2026-08-22");
  });

  it("lastNCstDateKeys returns n keys ending today", () => {
    const keys = lastNCstDateKeys(3, new Date("2026-08-21T12:00:00.000Z"));
    expect(keys).toHaveLength(3);
    expect(keys[2]).toBe("2026-08-21");
  });
});
