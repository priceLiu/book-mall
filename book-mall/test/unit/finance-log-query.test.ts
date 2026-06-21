import { describe, expect, it } from "vitest";

import { buildFinancePeriodSubmittedAt } from "@/lib/gateway/finance-log-query";
import { mergeGatewayLogFilters } from "@/lib/gateway/log-query-scope";

describe("finance-log-query", () => {
  it("buildFinancePeriodSubmittedAt uses half-open interval [from, to)", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const to = new Date("2026-07-01T00:00:00.000Z");
    expect(buildFinancePeriodSubmittedAt(from, to)).toEqual({
      submittedAt: { gte: from, lt: to },
    });
  });

  it("mergeGatewayLogFilters prefers submittedBefore (lt) for finance period end", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const to = new Date("2026-07-01T00:00:00.000Z");
    const merged = mergeGatewayLogFilters({}, { submittedFrom: from, submittedBefore: to });
    expect(merged).toEqual({
      submittedAt: { gte: from, lt: to },
    });
  });
});
