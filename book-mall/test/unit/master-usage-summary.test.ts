import { describe, expect, it } from "vitest";

import { buildMasterUsageSummary } from "@/lib/finance/reconciliation-v2/master-usage-summary";

describe("master-usage-summary", () => {
  it("aggregates platform usage by video / image / other", () => {
    const summary = buildMasterUsageSummary([
      { unitKind: "SEC", platformUnits: 100, platformListYuan: 50, platformCredits: 200 },
      { unitKind: "SEC", platformUnits: 23, platformListYuan: 10, platformCredits: 50 },
      { unitKind: "IMAGE", platformUnits: 93, platformListYuan: 18.6, platformCredits: 300 },
      { unitKind: "KTOKEN", platformUnits: 500, platformListYuan: 5, platformCredits: 100 },
      { unitKind: "CALL", platformUnits: 880, platformListYuan: 31.68, platformCredits: 880 },
    ]);

    const video = summary.buckets.find((b) => b.category === "video")!;
    const image = summary.buckets.find((b) => b.category === "image")!;
    const other = summary.buckets.find((b) => b.category === "other")!;

    expect(video.platformUnits).toBe(123);
    expect(video.unitLabel).toBe("秒");
    expect(image.platformUnits).toBe(93);
    expect(other.lineCount).toBe(2);
    expect(summary.totalPlatformCredits).toBe(1530);
  });
});
