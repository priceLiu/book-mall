import { describe, expect, it } from "vitest";

import {
  channelKeyLabel,
  normalizeDeepseekVendorKeyName,
} from "@/lib/finance/usage-daily/key-normalize";

describe("normalizeDeepseekVendorKeyName", () => {
  it("maps Book Mall console name to gw-platform-pool", () => {
    expect(normalizeDeepseekVendorKeyName("book mall")).toBe("gw-platform-pool");
    expect(normalizeDeepseekVendorKeyName("Book Mall")).toBe("gw-platform-pool");
    expect(normalizeDeepseekVendorKeyName("book-mall")).toBe("gw-platform-pool");
  });

  it("keeps legacy bilibili and canvas mappings", () => {
    expect(normalizeDeepseekVendorKeyName("bilibili")).toBe("gw-platform-pool");
    expect(normalizeDeepseekVendorKeyName("canvas")).toBe("gw-canvas-pro2");
  });

  it("labels book mall for display", () => {
    expect(channelKeyLabel("book mall")).toContain("Book Mall");
  });
});
