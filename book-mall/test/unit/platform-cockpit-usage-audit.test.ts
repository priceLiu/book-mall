import { describe, expect, it } from "vitest";

import { resolveUsageAuditStatusForTest } from "@/lib/admin/platform-cockpit-usage-audit";

describe("platform-cockpit-usage-audit", () => {
  it("flags MISSING_GATEWAY when platform far exceeds gateway", () => {
    expect(resolveUsageAuditStatusForTest(100, 38, true)).toBe("MISSING_GATEWAY");
  });

  it("OK when gateway covers most platform events (retries tolerated)", () => {
    expect(resolveUsageAuditStatusForTest(50, 80, true)).toBe("OK");
  });

  it("GATEWAY_ONLY when no business audit source", () => {
    expect(resolveUsageAuditStatusForTest(0, 42, false)).toBe("GATEWAY_ONLY");
  });

  it("ORPHAN_GATEWAY when gateway has calls but platform has none", () => {
    expect(resolveUsageAuditStatusForTest(0, 20, true)).toBe("ORPHAN_GATEWAY");
  });
});
