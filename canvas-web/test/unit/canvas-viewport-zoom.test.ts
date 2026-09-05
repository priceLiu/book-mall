import { describe, expect, it } from "vitest";

import {
  CANVAS_VIEWPORT_MAX_ZOOM,
  CANVAS_VIEWPORT_MIN_ZOOM,
  clampCanvasViewport,
  clampCanvasViewportZoom,
  canvasViewportZoomAtMax,
  canvasViewportZoomAtMin,
} from "@/lib/canvas/canvas-viewport-zoom";

describe("canvas-viewport-zoom", () => {
  it("clamps zoom to 5%～1000%", () => {
    expect(clampCanvasViewportZoom(0.02)).toBe(CANVAS_VIEWPORT_MIN_ZOOM);
    expect(clampCanvasViewportZoom(0.05)).toBe(0.05);
    expect(clampCanvasViewportZoom(1)).toBe(1);
    expect(clampCanvasViewportZoom(10)).toBe(10);
    expect(clampCanvasViewportZoom(32)).toBe(CANVAS_VIEWPORT_MAX_ZOOM);
  });

  it("clamps saved viewport on hydrate", () => {
    expect(
      clampCanvasViewport({ x: 12, y: -8, zoom: 0.01 }).zoom,
    ).toBe(CANVAS_VIEWPORT_MIN_ZOOM);
    expect(
      clampCanvasViewport({ x: 0, y: 0, zoom: 15 }).zoom,
    ).toBe(CANVAS_VIEWPORT_MAX_ZOOM);
  });

  it("detects min/max zoom edges", () => {
    expect(canvasViewportZoomAtMin(0.05)).toBe(true);
    expect(canvasViewportZoomAtMin(0.06)).toBe(false);
    expect(canvasViewportZoomAtMax(10)).toBe(true);
    expect(canvasViewportZoomAtMax(9.9)).toBe(false);
  });
});
