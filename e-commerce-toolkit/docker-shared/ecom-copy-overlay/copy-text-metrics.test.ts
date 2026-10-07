import { describe, expect, it } from "vitest";

import {
  composeOverlayTextLines,
  estimateLineWidthPx,
  resolveHorizontalTextBoxLayout,
} from "./copy-text-metrics";
import type { EcomCopyOverlayLayer } from "./types";

describe("copy-text-metrics", () => {
  it("estimateLineWidthPx is tighter than 1em per CJK char", () => {
    const w = estimateLineWidthPx("不惧风雨。", 36, true);
    expect(w).toBeLessThan(36 * 6);
    expect(w).toBeGreaterThan(36 * 4);
  });

  it("resolveHorizontalTextBoxLayout uses anchor as padded box top-left for left align", () => {
    const layer: EcomCopyOverlayLayer = {
      id: "main",
      text: "不惧风雨。",
      nx: 0.2,
      ny: 0.5,
      fontSize: 36,
      textAlign: "left",
      textBgEnabled: true,
      textBgPaddingPx: 10,
    };
    const layout = resolveHorizontalTextBoxLayout(layer, 750, 1000, ["不惧风雨。"], 600);
    expect(layout.boxX).toBe(150);
    expect(layout.boxY).toBe(375);
    expect(layout.textX).toBe(160);
    expect(layout.textY).toBe(385);
  });

  it("composeOverlayTextLines keeps short CJK on one line", () => {
    const lines = composeOverlayTextLines("不惧风雨。", 36, true, 600);
    expect(lines).toEqual(["不惧风雨。"]);
  });

  it("uses layoutBoxWidthPx for text background size", () => {
    const layer: EcomCopyOverlayLayer = {
      id: "main",
      text: "不惧风雨。",
      nx: 0.2,
      ny: 0.5,
      fontSize: 36,
      textAlign: "left",
      textBgEnabled: true,
      textBgPaddingPx: 10,
      layoutBoxWidthPx: 220,
      layoutBoxHeightPx: 72,
    };
    const layout = resolveHorizontalTextBoxLayout(layer, 750, 1000, ["不惧风雨。"], 600);
    expect(layout.boxW).toBe(220);
    expect(layout.boxH).toBe(72);
  });

  it("uses measured box norms for text background size", () => {
    const layer: EcomCopyOverlayLayer = {
      id: "main",
      text: "不惧风雨。",
      nx: 0.2,
      ny: 0.5,
      fontSize: 36,
      textAlign: "left",
      textBgEnabled: true,
      textBgPaddingPx: 10,
      layoutBoxWidthNorm: 0.2,
      layoutBoxHeightNorm: 0.08,
    };
    const layout = resolveHorizontalTextBoxLayout(layer, 750, 1000, ["不惧风雨。"], 600);
    expect(layout.boxW).toBe(150);
    expect(layout.boxH).toBe(80);
  });
});
