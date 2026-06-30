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
  libtvDockInnerContentZoom,
  libtvDockPromptFontScreenMetrics,
  libtvDockVideoHeaderScreenMetrics,
  libtvDockZoomOutContentBoost,
  DOCK_PROMPT_FONT_SCREEN_AT_100,
  VIDEO_DOCK_HEADER_CHIP_FONT_AT_100,
  VIDEO_DOCK_HEADER_THUMB_W_MAX,
  VIDEO_DOCK_HEADER_THUMB_H_MAX,
  VIDEO_DOCK_HEADER_THUMB_MIN_RATIO,
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

describe("libtvDockInnerContentZoom", () => {
  it("is 1 at zoom 1", () => {
    expect(libtvDockInnerContentZoom(1)).toBeCloseTo(1, 2);
  });

  it("compensates when canvas zooms in so content screen scale stays ~baseline", () => {
    const { w } = libtvDockFlowSize();
    const inv1 = computeLibtvDockInverseScale(1, w);
    const z = 2;
    const invZ = computeLibtvDockInverseScale(z, w);
    const cz = libtvDockInnerContentZoom(z);
    const contentAt1 = inv1 * 1 * 1;
    const contentAtZ = invZ * z * cz;
    expect(contentAtZ).toBeCloseTo(contentAt1, 0);
  });

  it("uses zoom-out boost below 100%", () => {
    expect(libtvDockInnerContentZoom(0.2)).toBe(3);
  });
});

describe("libtvDockPromptFontScreenMetrics", () => {
  it("is 2px smaller than baseline at max canvas zoom", () => {
    expect(libtvDockPromptFontScreenMetrics(2)).toBe(
      DOCK_PROMPT_FONT_SCREEN_AT_100 - 2,
    );
  });

  it("is 1px smaller than max at min canvas zoom anchor", () => {
    expect(libtvDockPromptFontScreenMetrics(0.15)).toBe(
      DOCK_PROMPT_FONT_SCREEN_AT_100 - 3,
    );
  });

  it("is baseline at 100% zoom", () => {
    expect(libtvDockPromptFontScreenMetrics(1)).toBe(
      DOCK_PROMPT_FONT_SCREEN_AT_100,
    );
  });
});

describe("libtvDockVideoHeaderScreenMetrics", () => {
  it("caps thumb at 96x91 when zoomed out (<=0.2)", () => {
    const m = libtvDockVideoHeaderScreenMetrics(0.2);
    expect(m.thumbWidthScreenPx).toBe(VIDEO_DOCK_HEADER_THUMB_W_MAX);
    expect(m.thumbHeightScreenPx).toBe(VIDEO_DOCK_HEADER_THUMB_H_MAX);
    expect(m.thumbScreenPx).toBe(VIDEO_DOCK_HEADER_THUMB_W_MAX);
  });

  it("holds 96x91 cap even below 0.2", () => {
    const m = libtvDockVideoHeaderScreenMetrics(0.08);
    expect(m.thumbWidthScreenPx).toBe(VIDEO_DOCK_HEADER_THUMB_W_MAX);
    expect(m.thumbHeightScreenPx).toBe(VIDEO_DOCK_HEADER_THUMB_H_MAX);
  });

  it("shrinks thumb to 90% of max when zoomed in (>=1)", () => {
    const m = libtvDockVideoHeaderScreenMetrics(1);
    expect(m.thumbWidthScreenPx).toBeCloseTo(
      VIDEO_DOCK_HEADER_THUMB_W_MAX * VIDEO_DOCK_HEADER_THUMB_MIN_RATIO,
      5,
    );
    expect(m.thumbHeightScreenPx).toBeCloseTo(
      VIDEO_DOCK_HEADER_THUMB_H_MAX * VIDEO_DOCK_HEADER_THUMB_MIN_RATIO,
      5,
    );
    const m2 = libtvDockVideoHeaderScreenMetrics(2);
    expect(m2.thumbWidthScreenPx).toBeCloseTo(
      VIDEO_DOCK_HEADER_THUMB_W_MAX * VIDEO_DOCK_HEADER_THUMB_MIN_RATIO,
      5,
    );
  });

  it("keeps chip font smaller at 15%", () => {
    const m = libtvDockVideoHeaderScreenMetrics(0.15);
    expect(m.chipFontScreenPx).toBe(VIDEO_DOCK_HEADER_CHIP_FONT_AT_100 - 2);
  });
});

describe("libtvDockZoomOutContentBoost", () => {
  it("is 1 at zoom 1 and 3 at zoom 0.2", () => {
    expect(libtvDockZoomOutContentBoost(1)).toBe(1);
    expect(libtvDockZoomOutContentBoost(0.2)).toBe(3);
  });
});

describe("computeLibtvDockInverseScale", () => {
  it("yields base screen width at zoom 1", () => {
    const { w } = libtvDockFlowSize();
    const inv = computeLibtvDockInverseScale(1, w);
    expect(w * 1 * inv).toBeCloseTo(LIBTV_DOCK_SCREEN_W_BASE, 0);
  });

  it("does not apply content boost to shell invScale", () => {
    const { w } = libtvDockFlowSize();
    const z = 0.2;
    const target = computeLibtvDockScreenWidth(z);
    const inv = computeLibtvDockInverseScale(z, w);
    expect(inv).toBeCloseTo(target / (w * z), 2);
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
