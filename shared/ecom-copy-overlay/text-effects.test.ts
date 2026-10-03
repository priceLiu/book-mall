import { describe, expect, it } from "vitest";

import { layerPreviewTextShadow, resolveLayerShadow } from "./text-effects";
import type { EcomCopyOverlayLayer } from "./types";

const base: EcomCopyOverlayLayer = {
  id: "main",
  text: "x",
  nx: 0.5,
  ny: 0.5,
  fontSize: 32,
};

describe("text-effects", () => {
  it("resolveLayerShadow returns null when shadowBlur is 0", () => {
    expect(resolveLayerShadow({ ...base, shadowBlur: 0 })).toBeNull();
  });

  it("layerPreviewTextShadow includes stroke and shadow when enabled", () => {
    const css = layerPreviewTextShadow(
      { ...base, shadowBlur: 10, strokeWidth: 2, strokeColor: "#000" },
      0.5,
    );
    expect(css).toMatch(/rgba\(0, 0, 0/);
    expect(css).toContain("0px");
  });

  it("no shadow css when shadow off", () => {
    expect(layerPreviewTextShadow(base, 1)).toBeUndefined();
  });
});
