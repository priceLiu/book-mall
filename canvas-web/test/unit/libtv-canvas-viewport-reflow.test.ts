import { describe, expect, it } from "vitest";

import {
  libtvCanvasNeedsViewportReflow,
  libtvViewportZoomNeedsReflow,
} from "@/lib/canvas/libtv-canvas-viewport-reflow";

describe("libtvViewportZoomNeedsReflow", () => {
  it("flags zoom outside 5%～1000%", () => {
    expect(libtvViewportZoomNeedsReflow(1)).toBe(false);
    expect(libtvViewportZoomNeedsReflow(1.5)).toBe(false);
    expect(libtvViewportZoomNeedsReflow(0.05)).toBe(false);
    expect(libtvViewportZoomNeedsReflow(10)).toBe(false);
    expect(libtvViewportZoomNeedsReflow(0.04)).toBe(true);
    expect(libtvViewportZoomNeedsReflow(10.5)).toBe(true);
  });
});

describe("libtvCanvasNeedsViewportReflow", () => {
  it("flags invalid saved viewport zoom", () => {
    expect(
      libtvCanvasNeedsViewportReflow([], { x: 0, y: 0, zoom: 1 }),
    ).toBe(false);
    expect(
      libtvCanvasNeedsViewportReflow([], { x: 0, y: 0, zoom: 2 }),
    ).toBe(false);
    expect(
      libtvCanvasNeedsViewportReflow([], { x: 0, y: 0, zoom: 0.04 }),
    ).toBe(true);
    expect(
      libtvCanvasNeedsViewportReflow([], { x: 0, y: 0, zoom: 12 }),
    ).toBe(true);
  });
});
