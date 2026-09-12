import { describe, expect, it } from "vitest";

import {
  getLayerCanvasStyle,
  initialDisplayOffsetForLayer,
  isBboxCropLayer,
  resolveLayerDrawPlacement,
} from "@/lib/image-layer-placement";
import type { ImageLayerStackItem } from "@/lib/image-layer-types";

function layer(partial: Partial<ImageLayerStackItem> & Pick<ImageLayerStackItem, "id">): ImageLayerStackItem {
  return {
    url: "https://example.com/l.png",
    zIndex: 1,
    isBackground: false,
    ...partial,
  };
}

describe("isBboxCropLayer", () => {
  it("treats small PNG as bbox crop", () => {
    expect(isBboxCropLayer(400, 600, 1000, 1500)).toBe(true);
  });

  it("treats near-full-frame PNG as full-frame layer", () => {
    expect(isBboxCropLayer(950, 1400, 1000, 1500)).toBe(false);
  });
});

describe("resolveLayerDrawPlacement", () => {
  it("places bbox crop at normalized rect", () => {
    const item = layer({
      id: "a",
      bbox: { normalized: [100, 200, 400, 800] },
    });
    const p = resolveLayerDrawPlacement({
      layer: item,
      naturalWidth: 300,
      naturalHeight: 600,
      canvasWidth: 1000,
      canvasHeight: 1500,
      displayScale: 1,
    });
    expect(p.mode).toBe("bbox-crop");
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(300);
    expect(p.width).toBeCloseTo(300);
    expect(p.height).toBeCloseTo(900);
  });

  it("full-frame layer aligns to canvas width", () => {
    const item = layer({ id: "b" });
    const p = resolveLayerDrawPlacement({
      layer: item,
      naturalWidth: 1000,
      naturalHeight: 1500,
      canvasWidth: 800,
      canvasHeight: 1200,
      displayScale: 2,
    });
    expect(p.mode).toBe("full-frame");
    expect(p.width).toBe(800);
    expect(p.height).toBe(1200);
  });
});

describe("getLayerCanvasStyle", () => {
  it("uses percentage box for bbox crop", () => {
    const item = layer({
      id: "c",
      bbox: { normalized: [100, 200, 400, 800] },
    });
    const { className, style } = getLayerCanvasStyle(
      item,
      300,
      600,
      1000,
      1500,
      5,
      10,
    );
    expect(className).toContain("absolute");
    expect(style.left).toBe("10%");
    expect(style.top).toBe(`${(200 / 1000) * 100}%`);
    expect(style.transform).toBe("translate(5px, 10px)");
  });
});

describe("initialDisplayOffsetForLayer", () => {
  it("returns zero for full-frame layers", () => {
    const item = layer({ id: "d" });
    expect(
      initialDisplayOffsetForLayer(item, 800, 1200, 1000, 1500, 1000, 1500),
    ).toEqual({ offsetX: 0, offsetY: 0 });
  });
});
