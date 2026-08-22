import { describe, expect, it } from "vitest";

import { inferVendorCodeFromModelKey, resolveVendorCodeForModel } from "@/lib/finance/infer-vendor-code";
import { formatBillingVendorLabel } from "@/lib/finance/billing-vendor-label";

describe("infer-vendor-code", () => {
  it("maps known prefixes to vendor codes", () => {
    expect(inferVendorCodeFromModelKey("qwen3.5-flash")).toBe("aliyun");
    expect(inferVendorCodeFromModelKey("happyhorse-1.1-r2v")).toBe("aliyun");
    expect(inferVendorCodeFromModelKey("kling-3.0-turbo-i2v")).toBe("kie");
    expect(inferVendorCodeFromModelKey("lib-nano-pro-2k")).toBe("kie");
    expect(inferVendorCodeFromModelKey("minimax-h3-2k")).toBe("minimax");
    expect(inferVendorCodeFromModelKey("deepseek-v3.2")).toBe("deepseek");
    expect(inferVendorCodeFromModelKey("Eleven/multilingual-sts-v2")).toBe("elevenlabs");
  });

  it("prefers catalog vendor over inference", () => {
    expect(resolveVendorCodeForModel("minimax-h3-2k", "kie")).toBe("kie");
  });

  it("does not return 其他 as label", () => {
    expect(formatBillingVendorLabel(inferVendorCodeFromModelKey("totally-unknown-model-xyz"))).toBe(
      "未登记",
    );
  });
});

describe("reconcile importVendor", () => {
  it("sets importVendor only from vendor CSV side", async () => {
    const { reconcileVendorAndPlatform } = await import(
      "@/lib/finance/reconciliation-v2/reconcile-engine"
    );
    const rows = reconcileVendorAndPlatform(
      [
        {
          vendor: "aliyun",
          joinKey: "aliyun|wan2.7-image|-IMAGE|none|202608",
          month: "202608",
          cloudAccountId: "1",
          modelKey: "wan2.7-image",
          tierRaw: null,
          unitKind: "IMAGE",
          tokenDirection: "none",
          vendorUnits: 10,
          listUnitYuan: 0.2,
          vendorListYuan: 2,
          csvRowCount: 1,
        },
      ],
      [
        {
          vendor: "kie",
          joinKey: "kie|kling-3.0-turbo-i2v|720P|SEC|none|202608",
          month: "202608",
          userId: "u1",
          modelKey: "kling-3.0-turbo-i2v",
          tierRaw: "720P",
          unitKind: "SEC",
          tokenDirection: "none",
          platformUnits: 100,
          listUnitYuan: 0.4,
          platformListYuan: 40,
          platformCredits: 50,
          platformRevenueYuan: 2,
          callCount: 1,
          sampleLogIds: [],
        },
      ],
    );
    const aliyunRow = rows.find((r) => r.joinKey.startsWith("aliyun|"));
    const kieRow = rows.find((r) => r.joinKey.startsWith("kie|"));
    expect(aliyunRow?.importVendor).toBe("aliyun");
    expect(kieRow?.importVendor).toBeNull();
    expect(kieRow?.reconStatus).toBe("MISSING_VENDOR");
  });
});
