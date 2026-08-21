import { describe, expect, it } from "vitest";

import { hideKieVendorLabel } from "@/lib/canvas/gateway-model-role";

describe("hideKieVendorLabel", () => {
  it("drops vendor-only parentheses", () => {
    expect(hideKieVendorLabel("Nano Banana 2 (KIE)")).toBe("Nano Banana 2");
  });

  it("drops leftover type parentheses after hiding KIE", () => {
    expect(hideKieVendorLabel("Seedream 4.5 (KIE · 文生图)")).toBe(
      "Seedream 4.5",
    );
    expect(hideKieVendorLabel("Seedream 5.0 Lite (KIE · 文生图)")).toBe(
      "Seedream 5.0 Lite",
    );
    expect(hideKieVendorLabel("Flux-2 Pro (KIE · 文生图)")).toBe("Flux-2 Pro");
    expect(hideKieVendorLabel("Seedance 2 (KIE · 图生视频)")).toBe(
      "Seedance 2",
    );
  });

  it("drops type-only parentheses already stored without KIE", () => {
    expect(hideKieVendorLabel("Seedream 4.5 (文生图)")).toBe("Seedream 4.5");
    expect(hideKieVendorLabel("Seedream 5.0 Lite（文生图）")).toBe(
      "Seedream 5.0 Lite",
    );
  });

  it("keeps product-name type that is not in parentheses", () => {
    expect(hideKieVendorLabel("Grok Imagine · 文生图 (KIE)")).toBe(
      "Grok Imagine · 文生图",
    );
    expect(hideKieVendorLabel("可灵 2.5 Turbo 图生视频 (KIE)")).toBe(
      "可灵 2.5 Turbo 图生视频",
    );
  });
});
