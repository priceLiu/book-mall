import { describe, expect, it } from "vitest";
import {
  computeLibtvNodeToolbarTransformScale,
  computeLibtvPortaledToolbarScale,
  computeLibtvToolbarScreenHeight,
  computeLibtvToolbarScreenWidth,
  LIBTV_NODE_TOOLBAR_MAX_SCALE,
  LIBTV_NODE_TOOLBAR_MIN_SCALE,
  LIBTV_TOOLBAR_DESIGN_HEIGHT,
  LIBTV_TOOLBAR_DESIGN_WIDTH,
  LIBTV_TOOLBAR_MAX_SCREEN_HEIGHT,
  LIBTV_TOOLBAR_MAX_SCREEN_WIDTH,
  LIBTV_TOOLBAR_ZOOMOUT_ANCHOR,
  libtvPortaledToolbarScreenSize,
} from "@/lib/canvas/libtv-node-toolbar-scale";

describe("computeLibtvNodeToolbarTransformScale", () => {
  it("is 1 at zoom 1 (on-screen 1x)", () => {
    expect(computeLibtvNodeToolbarTransformScale(1)).toBeCloseTo(1, 5);
  });

  it("fully compensates for inline node toolbar", () => {
    for (const z of [0.2, 0.5, 0.8]) {
      const scale = computeLibtvNodeToolbarTransformScale(z);
      expect(z * scale).toBeCloseTo(1, 5);
    }
  });

  it("reaches 10x at 10% zoom", () => {
    expect(computeLibtvNodeToolbarTransformScale(0.1)).toBeCloseTo(10, 5);
    expect(computeLibtvNodeToolbarTransformScale(0.1)).toBeLessThanOrEqual(
      LIBTV_NODE_TOOLBAR_MAX_SCALE,
    );
  });

  it("caps at max when zoomed out beyond 10%", () => {
    expect(computeLibtvNodeToolbarTransformScale(0.04)).toBe(
      LIBTV_NODE_TOOLBAR_MAX_SCALE,
    );
  });

  it("keeps on-screen ~1x at/above 100% until min floor", () => {
    expect(computeLibtvNodeToolbarTransformScale(2)).toBeCloseTo(0.5, 5);
    expect(computeLibtvNodeToolbarTransformScale(4)).toBe(
      LIBTV_NODE_TOOLBAR_MIN_SCALE,
    );
  });
});

describe("computeLibtvPortaledToolbarScale", () => {
  it("is ~1022×62 at 100% zoom", () => {
    expect(computeLibtvPortaledToolbarScale(1)).toBeCloseTo(1, 5);
    expect(computeLibtvToolbarScreenWidth(1)).toBe(LIBTV_TOOLBAR_DESIGN_WIDTH);
    expect(computeLibtvToolbarScreenHeight(1)).toBe(
      LIBTV_TOOLBAR_DESIGN_HEIGHT,
    );
  });

  it("caps portal scale to viewport width at 100% zoom", () => {
    expect(computeLibtvPortaledToolbarScale(1)).toBeLessThanOrEqual(1);
    expect(computeLibtvToolbarScreenWidth(1)).toBeLessThanOrEqual(1022);
  });

  it("does not enlarge toolbar when canvas is zoomed out", () => {
    const at17 = libtvPortaledToolbarScreenSize(0.17);
    const at100 = libtvPortaledToolbarScreenSize(1);
    expect(at17.scale).toBeLessThanOrEqual(at100.scale);
    expect(at17.width).toBeLessThanOrEqual(at100.width);
  });

  it("does not shrink below design min when zoomed in", () => {
    const { width, height } = libtvPortaledToolbarScreenSize(2);
    expect(width).toBe(LIBTV_TOOLBAR_DESIGN_WIDTH);
    expect(height).toBe(LIBTV_TOOLBAR_DESIGN_HEIGHT);
  });
});
