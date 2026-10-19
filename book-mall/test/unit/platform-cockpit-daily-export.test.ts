import { describe, expect, it } from "vitest";

import { buildCockpitDailyDashboardCsv } from "@/lib/admin/platform-cockpit-daily-export";
import type { CockpitDailyDashboardSnapshot } from "@/lib/admin/platform-cockpit-daily-dashboard";

const minimalSnapshot: CockpitDailyDashboardSnapshot = {
  businessDateCst: "2026-10-18",
  generatedAt: "2026-10-18T12:00:00.000Z",
  overview: {
    creditsFromGateway: 100,
    creditsFromLedger: 95,
    imageSucceeded: 3,
    videoSucceeded: 1,
    gatewaySucceeded: 5,
    gatewayFailed: 0,
    gatewayRunning: 0,
    costYuan: 12.5,
    costScanCount: 5,
    costTruncated: false,
    creditsDelta: 5,
    creditsDeltaRate: 0.05,
    creditReconcileAlert: true,
  },
  byApp: [],
  byProject: [],
  details: [],
};

describe("buildCockpitDailyDashboardCsv", () => {
  it("includes BOM and overview metrics", () => {
    const csv = buildCockpitDailyDashboardCsv(minimalSnapshot);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("credits_gateway,100");
    expect(csv).toContain("# by_app");
    expect(csv).toContain("# details");
  });
});
