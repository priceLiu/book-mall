import { describe, expect, it } from "vitest";
import {
  computeLibtvDockInverseScale,
  computeLibtvDockScreenWidth,
  LIBTV_DOCK_BASE_SCALE,
  LIBTV_DOCK_EXPAND_FACTOR,
  LIBTV_DOCK_FLOW_WIDTH,
  LIBTV_DOCK_SCREEN_W_BASE,
  LIBTV_DOCK_SCREEN_W_MAX,
  LIBTV_DOCK_SCREEN_W_MIN,
  LIBTV_DOCK_SIZE_FACTOR,
  libtvDockFlowSize,
  libtvDockHeightForWidth,
} from "@/lib/canvas/libtv-dock-scale";

describe("libtvDockHeightForWidth", () => {
  it("keeps 16:6 aspect with size factor", () => {
    expect(LIBTV_DOCK_FLOW_WIDTH).toBe(Math.round(1440 * LIBTV_DOCK_SIZE_FACTOR));
    expect(libtvDockHeightForWidth(LIBTV_DOCK_FLOW_WIDTH)).toBe(486);
    expect(libtvDockHeightForWidth(640)).toBe(240);
  });
});

describe("libtvDockFlowSize", () => {
  it("flow size is stable regardless of expanded flag", () => {
    const base = libtvDockFlowSize(false);
    const expanded = libtvDockFlowSize(true);
    expect(base).toEqual(expanded);
    expect(Math.abs(base.w * 6 - base.h * 16)).toBeLessThanOrEqual(8);
  });
});

describe("computeLibtvDockScreenWidth", () => {
  it("is base width at zoom 1", () => {
    expect(computeLibtvDockScreenWidth(1)).toBe(LIBTV_DOCK_SCREEN_W_BASE);
    expect(LIBTV_DOCK_SCREEN_W_MAX).toBe(LIBTV_DOCK_SCREEN_W_BASE);
  });

  it("shrinks to ~half (min) at 40% zoom out", () => {
    expect(computeLibtvDockScreenWidth(0.4)).toBe(LIBTV_DOCK_SCREEN_W_MIN);
    expect(LIBTV_DOCK_SCREEN_W_MIN).toBeCloseTo(LIBTV_DOCK_SCREEN_W_BASE / 2, 0);
  });

  it("floors at min when zoomed out further", () => {
    expect(computeLibtvDockScreenWidth(0.2)).toBe(LIBTV_DOCK_SCREEN_W_MIN);
  });

  it("allows shrink when zooming in", () => {
    expect(computeLibtvDockScreenWidth(2)).toBe(LIBTV_DOCK_SCREEN_W_MIN);
  });

  it("uses +40% base with -10% size factor at zoom 1", () => {
    expect(LIBTV_DOCK_SCREEN_W_BASE).toBe(
      Math.round(1200 * LIBTV_DOCK_BASE_SCALE * LIBTV_DOCK_SIZE_FACTOR),
    );
  });

  it("expands screen width by 20% when expanded", () => {
    expect(computeLibtvDockScreenWidth(1, true)).toBeCloseTo(
      LIBTV_DOCK_SCREEN_W_BASE * LIBTV_DOCK_EXPAND_FACTOR,
      0,
    );
  });
});

describe("computeLibtvDockInverseScale", () => {
  it("yields base screen width at zoom 1", () => {
    const { w } = libtvDockFlowSize();
    const inv = computeLibtvDockInverseScale(1, w);
    expect(w * 1 * inv).toBeCloseTo(LIBTV_DOCK_SCREEN_W_BASE, 0);
  });

  it("yields ~20% larger than base when expanded", () => {
    const { w } = libtvDockFlowSize();
    const inv = computeLibtvDockInverseScale(1, w, true);
    expect(w * 1 * inv).toBeCloseTo(
      LIBTV_DOCK_SCREEN_W_BASE * LIBTV_DOCK_EXPAND_FACTOR,
      0,
    );
  });
});
