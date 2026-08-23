import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolveReconciliationVendorCode,
  resolveVendorCodeForModel,
} from "@/lib/finance/infer-vendor-code";
import { rollupDeepseekPlatformLinesForCostMatch } from "@/lib/finance/reconciliation-v2/deepseek-platform-rollup";
import {
  parseDeepseekUsageBillCsvSync,
} from "@/lib/finance/reconciliation-v2/deepseek-usage-v2-adapter";
import { buildJoinKey } from "@/lib/finance/reconciliation-v2/billable-units";
import { reconcileVendorAndPlatform } from "@/lib/finance/reconciliation-v2/reconcile-engine";
import type { PlatformUsageLine, VendorBillLine } from "@/lib/finance/reconciliation-v2/types";
import {
  resolveDeepseekReconciliationModelKey,
} from "@/lib/pricing/deepseek-v4-pricing";
import {
  detectVendorBillFormat,
} from "@/lib/finance/reconciliation-v2/vendor-bill-file";

const costFixture = readFileSync(
  join(process.cwd(), "test/fixtures/deepseek-cost-sample.csv"),
  "utf8",
);
const amountFixture = readFileSync(
  join(process.cwd(), "test/fixtures/deepseek-amount-sample.csv"),
  "utf8",
);

describe("deepseek-usage-v2-adapter", () => {
  it("parses amount CSV with model normalization", () => {
    const parsed = parseDeepseekUsageBillCsvSync(amountFixture);
    expect(parsed.source).toBe("amount");
    expect(parsed.lines.length).toBeGreaterThan(0);
    expect(parsed.lines.every((l) => l.vendor === "deepseek")).toBe(true);
    const flashIn = parsed.lines.find(
      (l) => l.modelKey === "deepseek-v4-flash" && l.tokenDirection === "input",
    );
    expect(flashIn?.vendorUnits).toBeGreaterThan(0);
  });

  it("prefers amount token lines when both CSVs provided", () => {
    const parsed = parseDeepseekUsageBillCsvSync(amountFixture, { extraCsv: costFixture });
    expect(parsed.source).toBe("merged");
    expect(parsed.lines.some((l) => l.tokenDirection === "input")).toBe(true);
    expect(parsed.lines.some((l) => l.tokenDirection === "output")).toBe(true);
    const total = parsed.lines.reduce((s, l) => s + l.vendorListYuan, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("parses cost-only CSV total from cost fixture", () => {
    const parsed = parseDeepseekUsageBillCsvSync(costFixture);
    const total = parsed.lines.reduce((s, l) => s + l.vendorListYuan, 0);
    expect(total).toBeCloseTo(129.62, 1);
  });

  it("parses cost-only CSV with tokenDirection none", () => {
    const parsed = parseDeepseekUsageBillCsvSync(costFixture);
    expect(parsed.source).toBe("cost");
    expect(parsed.lines.every((l) => l.tokenDirection === "none")).toBe(true);
    expect(parsed.lines.every((l) => l.vendorUnits === 0)).toBe(true);
    expect(parsed.lines.some((l) => l.vendorListYuan > 0)).toBe(true);
  });

  it("normalizes deepseek-chat to deepseek-v4-flash", () => {
    expect(resolveDeepseekReconciliationModelKey("deepseek-chat")).toBe("deepseek-v4-flash");
  });

  it("detects deepseek bill format", () => {
    expect(detectVendorBillFormat(amountFixture)).toBe("deepseek");
    expect(detectVendorBillFormat(costFixture)).toBe("deepseek");
  });
});

describe("resolveReconciliationVendorCode", () => {
  it("prefers DEEPSEEK providerKind over aliyun catalog", () => {
    expect(
      resolveReconciliationVendorCode({
        providerKind: "DEEPSEEK",
        modelKey: "deepseek-v4-flash",
        catalogVendor: "aliyun",
      }),
    ).toBe("deepseek");
  });

  it("keeps bailian-resold deepseek on aliyun", () => {
    expect(
      resolveReconciliationVendorCode({
        providerKind: "BAILIAN",
        modelKey: "deepseek-v4-flash",
        catalogVendor: "aliyun",
      }),
    ).toBe("aliyun");
  });

  it("falls back to catalog vendor", () => {
    expect(resolveVendorCodeForModel("deepseek-chat", "deepseek")).toBe("deepseek");
  });
});

describe("deepseek reconciliation join", () => {
  const period = { from: "2026-08-01", to: "2026-08-21" };
  const periodKey = "20260801_20260821";

  function vendorLine(over: Partial<VendorBillLine>): VendorBillLine {
    return {
      vendor: "deepseek",
      joinKey: over.joinKey ?? "deepseek|deepseek-v4-flash|-|KTOKEN|input|20260801_20260821",
      month: "202608",
      period,
      periodKey,
      cloudAccountId: null,
      modelKey: "deepseek-v4-flash",
      tierRaw: null,
      unitKind: "KTOKEN",
      tokenDirection: "input",
      vendorUnits: 100,
      listUnitYuan: 0.001,
      vendorListYuan: 0.1,
      csvRowCount: 1,
      ...over,
    };
  }

  function platformLine(over: Partial<PlatformUsageLine>): PlatformUsageLine {
    const joinKey =
      over.joinKey ??
      buildJoinKey({
        vendor: "deepseek",
        modelKey: "deepseek-v4-flash",
        tierRaw: null,
        unitKind: "KTOKEN",
        tokenDirection: "input",
        periodKey,
      });
    return {
      vendor: "deepseek",
      joinKey,
      month: "202608",
      period,
      periodKey,
      userId: null,
      modelKey: "deepseek-v4-flash",
      tierRaw: null,
      unitKind: "KTOKEN",
      tokenDirection: "input",
      platformUnits: 100,
      listUnitYuan: 0.001,
      platformListYuan: 0.1,
      platformNetCostYuan: 0.08,
      platformCredits: 0,
      platformRevenueYuan: 0,
      callCount: 1,
      sampleLogIds: ["log1"],
      ...over,
    };
  }

  it("joins OK when vendor and platform share normalized joinKey", () => {
    const joinKey = buildJoinKey({
      vendor: "deepseek",
      modelKey: "deepseek-v4-flash",
      tierRaw: null,
      unitKind: "KTOKEN",
      tokenDirection: "input",
      periodKey,
    });
    const rows = reconcileVendorAndPlatform(
      [vendorLine({ joinKey, vendorUnits: 100, vendorListYuan: 0.1 })],
      [platformLine({ joinKey, platformUnits: 100, platformListYuan: 0.1 })],
    );
    expect(rows[0]?.reconStatus).toBe("OK");
  });

  it("fails join when platform uses aliyun vendor key", () => {
    const vendorJoin = buildJoinKey({
      vendor: "deepseek",
      modelKey: "deepseek-v4-flash",
      tierRaw: null,
      unitKind: "KTOKEN",
      tokenDirection: "input",
      periodKey,
    });
    const platformJoin = buildJoinKey({
      vendor: "aliyun",
      modelKey: "deepseek-v4-flash",
      tierRaw: null,
      unitKind: "KTOKEN",
      tokenDirection: "input",
      periodKey,
    });
    const rows = reconcileVendorAndPlatform(
      [vendorLine({ joinKey: vendorJoin })],
      [platformLine({ joinKey: platformJoin, vendor: "aliyun" })],
    );
    expect(rows.some((r) => r.reconStatus === "OK")).toBe(false);
    expect(rows.some((r) => r.reconStatus === "MISSING_PLATFORM")).toBe(true);
    expect(rows.some((r) => r.reconStatus === "MISSING_VENDOR")).toBe(true);
  });

  it("rollup merges platform lines for cost-only vendor bill", () => {
    const costVendor = vendorLine({
      tokenDirection: "none",
      vendorUnits: 0,
      vendorListYuan: 1.5,
      joinKey: buildJoinKey({
        vendor: "deepseek",
        modelKey: "deepseek-v4-flash",
        tierRaw: null,
        unitKind: "KTOKEN",
        tokenDirection: "none",
        periodKey,
      }),
    });
    const rolled = rollupDeepseekPlatformLinesForCostMatch(
      [
        platformLine({
          tokenDirection: "input",
          platformUnits: 60,
          platformListYuan: 0.9,
        }),
        platformLine({
          tokenDirection: "output",
          platformUnits: 40,
          platformListYuan: 0.6,
          joinKey: buildJoinKey({
            vendor: "deepseek",
            modelKey: "deepseek-v4-flash",
            tierRaw: null,
            unitKind: "KTOKEN",
            tokenDirection: "output",
            periodKey,
          }),
        }),
      ],
      [costVendor],
    );
    expect(rolled).toHaveLength(1);
    expect(rolled[0]?.tokenDirection).toBe("none");
    expect(rolled[0]?.platformUnits).toBe(0);
    expect(rolled[0]?.platformListYuan).toBeCloseTo(1.5, 2);

    const rows = reconcileVendorAndPlatform([costVendor], rolled);
    expect(rows[0]?.reconStatus).toBe("OK");
  });
});
