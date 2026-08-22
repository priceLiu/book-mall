import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  KIE_CREDIT_YUAN,
  parseKieUsageBillCsvSync,
} from "@/lib/finance/reconciliation-v2/kie-usage-v2-adapter";
import { rollupKiePlatformLinesByCredits } from "@/lib/finance/reconciliation-v2/kie-platform-rollup";
import { reconcileVendorAndPlatform } from "@/lib/finance/reconciliation-v2/reconcile-engine";
import {
  detectVendorBillFormat,
  readVendorBillFileToCsvText,
} from "@/lib/finance/reconciliation-v2/vendor-bill-file";

const fixtureCsv = readFileSync(
  join(process.cwd(), "test/fixtures/kie-usage-sample.csv"),
  "utf8",
);

describe("kie-usage-v2-adapter", () => {
  it("parses usage_data and aggregates credits by model-month", async () => {
    const parsed = parseKieUsageBillCsvSync(fixtureCsv);
    expect(parsed.taskRowCount).toBe(127);
    expect(parsed.months).toContain("202608");
    expect(parsed.lines.length).toBeGreaterThan(0);

    const nano = parsed.lines.find((l) => l.modelKey === "nano-banana-pro");
    expect(nano?.vendor).toBe("kie");
    expect(nano?.unitKind).toBe("CALL");
    expect(nano?.vendorUnits).toBe(880);
    expect(nano?.listUnitYuan).toBe(KIE_CREDIT_YUAN);
    expect(nano?.vendorListYuan).toBeCloseTo(880 * KIE_CREDIT_YUAN, 2);

    const totalCredits = parsed.lines.reduce((s, l) => s + l.vendorUnits, 0);
    expect(totalCredits).toBeCloseTo(1596.31, 1);
  });

  it("detects kie format in vendor-bill-file", async () => {
    expect(detectVendorBillFormat(fixtureCsv)).toBe("kie");
    const { format } = await readVendorBillFileToCsvText({
      buffer: Buffer.from(fixtureCsv, "utf8"),
      filename: "usage_data.csv",
      vendor: "kie",
    });
    expect(format).toBe("kie");
  });
});

describe("kie platform rollup", () => {
  it("rolls up platform credits for kie vendor lines", () => {
    const rolled = rollupKiePlatformLinesByCredits([
      {
        vendor: "kie",
        joinKey: "kie|nano-banana-pro|-|CALL|none|20260801_20260831",
        month: "202608",
        period: { from: "2026-08-01", to: "2026-08-31" },
        periodKey: "20260801_20260831",
        userId: "u1",
        modelKey: "nano-banana-pro",
        tierRaw: "720P",
        unitKind: "IMAGE",
        tokenDirection: "none",
        platformUnits: 10,
        listUnitYuan: 0.14,
        platformListYuan: 1.4,
        platformCredits: 100,
        platformRevenueYuan: 4,
        callCount: 10,
        sampleLogIds: ["log1"],
      },
      {
        vendor: "kie",
        joinKey: "kie|nano-banana-pro|-|CALL|none|20260801_20260831",
        month: "202608",
        period: { from: "2026-08-01", to: "2026-08-31" },
        periodKey: "20260801_20260831",
        userId: "u1",
        modelKey: "nano-banana-pro",
        tierRaw: "1080P",
        unitKind: "IMAGE",
        tokenDirection: "none",
        platformUnits: 5,
        listUnitYuan: 0.14,
        platformListYuan: 0.7,
        platformCredits: 50,
        platformRevenueYuan: 2,
        callCount: 5,
        sampleLogIds: ["log2"],
      },
    ]);

    expect(rolled).toHaveLength(1);
    expect(rolled[0]!.modelKey).toBe("nano-banana-pro");
    expect(rolled[0]!.platformUnits).toBe(150);
    expect(rolled[0]!.platformCredits).toBe(150);
    expect(rolled[0]!.unitKind).toBe("CALL");
  });

  it("reconciles kie vendor credits vs platform credits rollup", async () => {
    const parsed = parseKieUsageBillCsvSync(fixtureCsv);
    const vendorLine = parsed.lines.find((l) => l.modelKey === "nano-banana-pro")!;
    const platform = rollupKiePlatformLinesByCredits([
      {
        vendor: "kie",
        joinKey: "x",
        month: vendorLine.month,
        period: vendorLine.period,
        periodKey: vendorLine.periodKey,
        userId: "u1",
        modelKey: "nano-banana-pro",
        tierRaw: null,
        unitKind: "IMAGE",
        tokenDirection: "none",
        platformUnits: 880,
        listUnitYuan: 0.14,
        platformListYuan: 123,
        platformCredits: 880,
        platformRevenueYuan: 35,
        callCount: 50,
        sampleLogIds: [],
      },
    ]);

    const rows = reconcileVendorAndPlatform([vendorLine], platform);
    const row = rows.find((r) => r.modelKey === "nano-banana-pro");
    expect(row?.reconStatus).toBe("OK");
    expect(row?.importVendor).toBe("kie");
  });
});
