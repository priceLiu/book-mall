import { describe, expect, it } from "vitest";

import { resolveVtonFullBodyExpandRefLayout } from "@/lib/ecom/ecom-vton/full-body-expand-ref-layout";

describe("resolveVtonFullBodyExpandRefLayout", () => {
  it("keeps full_body refs unchanged", () => {
    expect(resolveVtonFullBodyExpandRefLayout("full_body", 800, 1600)).toEqual({
      mode: "original",
    });
  });

  it("uses smaller canvas anchor for elongated portrait refs", () => {
    const layout = resolveVtonFullBodyExpandRefLayout("portrait", 600, 900);
    expect(layout.mode).toBe("canvas");
    if (layout.mode === "canvas") {
      expect(layout.elongated).toBe(true);
      expect(layout.maxHeightRatio).toBeLessThanOrEqual(0.14);
    }
  });

  it("uses standard portrait anchor for square-ish headshots", () => {
    const layout = resolveVtonFullBodyExpandRefLayout("portrait", 800, 880);
    expect(layout.mode).toBe("canvas");
    if (layout.mode === "canvas") {
      expect(layout.elongated).toBe(false);
      expect(layout.maxHeightRatio).toBeGreaterThan(0.14);
    }
  });

  it("allows taller anchor for half_body refs", () => {
    const layout = resolveVtonFullBodyExpandRefLayout("half_body", 900, 1200);
    expect(layout.mode).toBe("canvas");
    if (layout.mode === "canvas") {
      expect(layout.maxHeightRatio).toBeGreaterThan(0.25);
      expect(layout.maxHeightRatio).toBeLessThan(0.32);
    }
  });
});
