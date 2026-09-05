import { describe, expect, it } from "vitest";

import { aggregatePlatformUsageFromLogs } from "@/lib/finance/reconciliation-v2/platform-usage-aggregator";
import { reconcileVendorAndPlatform } from "@/lib/finance/reconciliation-v2/reconcile-engine";
import type { VendorBillLine } from "@/lib/finance/reconciliation-v2/types";

describe("reconciliation v2 engine", () => {
  const vendorLine = (over: Partial<VendorBillLine>): VendorBillLine => ({
    vendor: "aliyun",
    joinKey: over.joinKey ?? "aliyun|wan2.7-image|-IMAGE|none|20260801_20260831",
    month: "202608",
    period: { from: "2026-08-01", to: "2026-08-31" },
    periodKey: "20260801_20260831",
    cloudAccountId: "acc1",
    modelKey: "wan2.7-image",
    tierRaw: null,
    unitKind: "IMAGE",
    tokenDirection: "none",
    vendorUnits: 93,
    listUnitYuan: 0.2,
    vendorListYuan: 18.6,
    csvRowCount: 1,
    ...over,
  });

  it("marks matching usage as OK", () => {
    const joinKey = "aliyun|wan2.7-image|-IMAGE|none|20260801_20260831";
    const v = [vendorLine({ joinKey })];
    const p = aggregatePlatformUsageFromLogs(
      [
        {
          id: "log1",
          status: "SUCCEEDED",
          requestKind: "IMAGE",
          model: "wan2.7-image",
          canonicalModelKey: "wan2.7-image",
          submittedAt: new Date("2026-08-15T12:00:00Z"),
          creditsCharged: 100,
          pricePerCreditSnapshotYuan: 0.04,
        },
      ],
      { "wan2.7-image": 0.2 },
    );
    p[0]!.joinKey = joinKey;
    p[0]!.platformUnits = 93;
    p[0]!.platformListYuan = 18.6;
    const rows = reconcileVendorAndPlatform(v, p);
    const row = rows.find((r) => r.joinKey === joinKey);
    expect(row?.reconStatus).toBe("OK");
    expect(row?.platformNetCostYuan).toBeGreaterThanOrEqual(0);
  });

  it("marks UNDER when platform has less ASR seconds", () => {
    const joinKey = "aliyun|qwen3-asr-flash-filetrans|-AUDIO_SEC|none|20260801_20260831";
    const v = [
      vendorLine({
        joinKey,
        modelKey: "qwen3-asr-flash-filetrans",
        unitKind: "AUDIO_SEC",
        vendorUnits: 1039,
        listUnitYuan: 0.00022,
        vendorListYuan: 0.22858,
      }),
    ];
    const p = aggregatePlatformUsageFromLogs([
      {
        id: "asr1",
        status: "SUCCEEDED",
        model: "qwen3-asr-flash-filetrans",
        canonicalModelKey: "qwen3-asr-flash-filetrans",
        resultSummary: { segmentCount: 1 },
        submittedAt: new Date("2026-08-10"),
      },
    ]);
    p[0]!.joinKey = joinKey;
    p[0]!.platformUnits = 430;
    const rows = reconcileVendorAndPlatform(v, p);
    expect(rows[0]!.reconStatus).toBe("UNDER_PLATFORM");
    expect(rows[0]!.issueReason).toMatch(/audioDurationSec/);
  });

  it("marks MISSING_VENDOR when platform only", () => {
    const v = [vendorLine({ vendorUnits: 0, vendorListYuan: 0 })];
    v.pop();
    const p = aggregatePlatformUsageFromLogs([
      {
        status: "SUCCEEDED",
        requestKind: "IMAGE",
        model: "orphan-model",
        canonicalModelKey: "orphan-model",
        submittedAt: new Date("2026-08-01"),
      },
    ]);
    const rows = reconcileVendorAndPlatform([], p);
    expect(rows[0]!.reconStatus).toBe("MISSING_VENDOR");
  });
});
