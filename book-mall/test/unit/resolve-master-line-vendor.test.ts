import { describe, expect, it } from "vitest";

import {
  resolveMasterLineVendor,
  vendorCodeFromJoinKey,
} from "@/lib/finance/billing-vendor-label";

describe("resolveMasterLineVendor", () => {
  it("uses joinKey vendor over catalog", () => {
    const r = resolveMasterLineVendor({
      joinKey: "deepseek|deepseek-v4-pro|-|KTOKEN|input|20260724_20260822",
      modelKey: "deepseek-v4-pro",
      catalogVendor: "aliyun",
    });
    expect(r.vendorCode).toBe("deepseek");
    expect(r.vendorDisplayName).toBe("DeepSeek");
    expect(r.catalogMismatch).toBe(true);
  });

  it("qwen → 阿里云", () => {
    const r = resolveMasterLineVendor({
      joinKey: "aliyun|qwen3-vl-plus|-|KTOKEN|none|20260801_20260831",
      modelKey: "qwen3-vl-plus",
      catalogVendor: "aliyun",
    });
    expect(r.vendorDisplayName).toBe("阿里云");
    expect(r.catalogMismatch).toBe(false);
  });

  it("kie joinKey", () => {
    const r = resolveMasterLineVendor({
      joinKey: "kie|nano-banana-pro|-|CALL|none|20260801_20260831",
      modelKey: "nano-banana-pro",
    });
    expect(r.vendorDisplayName).toBe("KIE");
  });

  it("unknown joinKey falls back to kie for lib-nano-pro", () => {
    const r = resolveMasterLineVendor({
      joinKey: "unknown|lib-nano-pro-2k|-|IMAGE|none|20260724_20260822",
      modelKey: "lib-nano-pro-2k",
    });
    expect(r.vendorCode).toBe("kie");
    expect(r.vendorDisplayName).toBe("KIE");
  });

  it("vendorCodeFromJoinKey", () => {
    expect(vendorCodeFromJoinKey("aliyun|wan2.7-image|-IMAGE|none|202608")).toBe("aliyun");
  });
});
