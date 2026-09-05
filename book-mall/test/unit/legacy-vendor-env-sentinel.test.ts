import { describe, expect, it } from "vitest";

import {
  LEGACY_VENDOR_ENV_VARS,
  scanLegacyVendorEnvs,
  vendorKeyFingerprint,
} from "@/lib/gateway/legacy-vendor-env-sentinel";

describe("legacy-vendor-env-sentinel", () => {
  it("无废弃 env 时返回空", () => {
    expect(scanLegacyVendorEnvs({})).toEqual([]);
    expect(scanLegacyVendorEnvs({ DEEPSEEK_API_KEY: "  " })).toEqual([]);
  });

  it("命中 DEEPSEEK_API_KEY 并只回指纹（不含原文）", () => {
    const hits = scanLegacyVendorEnvs({ DEEPSEEK_API_KEY: "sk-918fdeadbeef" });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.name).toBe("DEEPSEEK_API_KEY");
    expect(hits[0]!.keyFingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(hits)).not.toContain("sk-918fdeadbeef");
  });

  it("指纹稳定且随值变化", () => {
    const a = vendorKeyFingerprint("sk-aaa");
    expect(vendorKeyFingerprint("sk-aaa")).toBe(a);
    expect(vendorKeyFingerprint("sk-bbb")).not.toBe(a);
  });

  it("废弃清单当前只含 DEEPSEEK_API_KEY", () => {
    expect(LEGACY_VENDOR_ENV_VARS).toContain("DEEPSEEK_API_KEY");
  });
});
