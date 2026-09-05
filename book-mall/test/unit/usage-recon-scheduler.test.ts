import { describe, expect, it } from "vitest";

import {
  pickUsageReconAlertRows,
  shouldRunUsageReconTick,
} from "@/lib/gateway/usage-recon-scheduler";
import type { UsageAuditSnapshot } from "@/lib/admin/platform-cockpit-usage-audit";

describe("shouldRunUsageReconTick", () => {
  it("CST 凌晨 1 点前不跑", () => {
    // UTC 16:30 = CST 次日 00:30
    const now = new Date("2026-08-24T16:30:00Z");
    const d = shouldRunUsageReconTick(now, null);
    expect(d.run).toBe(false);
    expect(d.todayCst).toBe("2026-08-25");
    expect(d.auditDate).toBe("2026-08-24");
  });

  it("跨日后首 tick 运行，审计昨日", () => {
    // UTC 2026-08-24 18:00 = CST 2026-08-25 02:00
    const now = new Date("2026-08-24T18:00:00Z");
    const d = shouldRunUsageReconTick(now, "2026-08-24");
    expect(d.run).toBe(true);
    expect(d.todayCst).toBe("2026-08-25");
    expect(d.auditDate).toBe("2026-08-24");
  });

  it("当日已跑过则跳过（幂等，一日一次）", () => {
    const now = new Date("2026-08-24T18:00:00Z");
    const d = shouldRunUsageReconTick(now, "2026-08-25");
    expect(d.run).toBe(false);
  });
});

describe("pickUsageReconAlertRows", () => {
  it("只挑 MISSING_GATEWAY / ORPHAN_GATEWAY", () => {
    const snapshot = {
      from: "2026-08-24",
      to: "2026-08-24",
      alertCount: 2,
      rows: [
        {
          appKey: "CANVAS",
          appLabel: "Canvas",
          platformCount: 100,
          gatewayCount: 10,
          diff: 90,
          status: "MISSING_GATEWAY",
          auditSource: "CanvasGenerationTask",
        },
        {
          appKey: "STORY",
          appLabel: "Story",
          platformCount: 0,
          gatewayCount: 5,
          diff: -5,
          status: "ORPHAN_GATEWAY",
          auditSource: "StoryGenerationTask",
        },
        {
          appKey: "TOOL",
          appLabel: "Tool",
          platformCount: 10,
          gatewayCount: 10,
          diff: 0,
          status: "OK",
          auditSource: "ToolUsageEvent",
        },
        {
          appKey: "EXTERNAL",
          appLabel: "外部",
          platformCount: 0,
          gatewayCount: 3,
          diff: -3,
          status: "GATEWAY_ONLY",
          auditSource: null,
        },
      ],
    } as unknown as UsageAuditSnapshot;
    const alerts = pickUsageReconAlertRows(snapshot);
    expect(alerts.map((r) => r.appKey)).toEqual(["CANVAS", "STORY"]);
  });
});
