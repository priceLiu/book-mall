import { describe, expect, it } from "vitest";

import {
  buildVendorListCostPatches,
  syncVendorListPricesFromBillLines,
} from "@/lib/pricing/sync-vendor-list-cost-profile";
import type { VendorBillLine } from "@/lib/finance/reconciliation-v2/types";

describe("sync-vendor-list-cost-profile", () => {
  const line = (over: Partial<VendorBillLine>): VendorBillLine => ({
    vendor: "aliyun",
    joinKey: "k",
    month: "202608",
    period: { from: "2026-08-01", to: "2026-08-31" },
    periodKey: "20260801_20260831",
    cloudAccountId: null,
    modelKey: "wan2.7-image",
    tierRaw: null,
    unitKind: "IMAGE",
    tokenDirection: "none",
    vendorUnits: 10,
    listUnitYuan: 0.2,
    vendorListYuan: 2,
    csvRowCount: 1,
    ...over,
  });

  it("merges KTOKEN input/output into one profile patch", () => {
    const patches = buildVendorListCostPatches([
      line({
        modelKey: "qwen-turbo",
        unitKind: "KTOKEN",
        tokenDirection: "input",
        listUnitYuan: 0.002,
      }),
      line({
        modelKey: "qwen-turbo",
        unitKind: "KTOKEN",
        tokenDirection: "output",
        listUnitYuan: 0.006,
      }),
    ]);
    expect(patches).toHaveLength(1);
    expect(patches[0]!.inputListCostYuan).toBe(0.002);
    expect(patches[0]!.outputListCostYuan).toBe(0.006);
  });

  it("skips CALL unitKind (KIE credits)", () => {
    const patches = buildVendorListCostPatches([
      line({ unitKind: "CALL", listUnitYuan: 0.036 }),
    ]);
    expect(patches).toHaveLength(0);
  });

  it("exports sync function", () => {
    expect(typeof syncVendorListPricesFromBillLines).toBe("function");
  });
});
