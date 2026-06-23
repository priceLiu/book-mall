import { describe, expect, it } from "vitest";

import {
  buildEmptyCategoryCounts,
  dashboardStatusBucket,
  mergeStatusGroupCounts,
} from "@/lib/gateway/log-dashboard-projection";
import {
  parseDashboardHoursParam,
  parseLogStatusesParam,
} from "@/lib/gateway/log-query-params";
import { parseDashboardScopeParam } from "@/lib/gateway/log-dashboard-query";

describe("dashboardStatusBucket", () => {
  it("maps GatewayRequestStatus to dashboard buckets", () => {
    expect(dashboardStatusBucket("PENDING")).toBe("inProgress");
    expect(dashboardStatusBucket("RUNNING")).toBe("inProgress");
    expect(dashboardStatusBucket("SUCCEEDED")).toBe("succeeded");
    expect(dashboardStatusBucket("FAILED")).toBe("failed");
    expect(dashboardStatusBucket("CANCELLED")).toBe("cancelled");
  });
});

describe("mergeStatusGroupCounts", () => {
  it("aggregates inProgress from PENDING and RUNNING", () => {
    const cards = mergeStatusGroupCounts([
      { status: "PENDING", count: 2 },
      { status: "RUNNING", count: 3 },
      { status: "SUCCEEDED", count: 10 },
      { status: "FAILED", count: 1 },
      { status: "CANCELLED", count: 1 },
    ]);
    expect(cards).toEqual({
      inProgress: 5,
      succeeded: 10,
      failed: 1,
      cancelled: 1,
      slowWarn: 0,
      backgroundWait: 0,
    });
  });
});

describe("buildEmptyCategoryCounts", () => {
  it("returns chart billing categories without OTHER", () => {
    const rows = buildEmptyCategoryCounts();
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.count === 0)).toBe(true);
    expect(rows.some((r) => r.category === "OTHER")).toBe(false);
    expect(rows[0]?.category).toBe("TEXT_TO_IMAGE");
  });
});

describe("parseDashboardHoursParam", () => {
  it("accepts preset hours only", () => {
    expect(parseDashboardHoursParam("1")).toBe(1);
    expect(parseDashboardHoursParam("12")).toBe(12);
    expect(parseDashboardHoursParam("24")).toBeUndefined();
  });
});

describe("parseLogStatusesParam", () => {
  it("parses comma-separated statuses", () => {
    expect(parseLogStatusesParam("PENDING,RUNNING")).toEqual([
      "PENDING",
      "RUNNING",
    ]);
    expect(parseLogStatusesParam("bogus")).toBeUndefined();
  });
});

describe("parseDashboardScopeParam", () => {
  it("defaults to all", () => {
    expect(parseDashboardScopeParam(null)).toBe("all");
    expect(parseDashboardScopeParam("team")).toBe("team");
  });
});
