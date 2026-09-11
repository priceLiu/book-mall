import { describe, expect, it } from "vitest";

import { gridSplitCropRegion } from "@/lib/canvas/libtv-grid-split-crop";
import {
  LIBTV_GRID_SPLIT_MAX,
  LIBTV_GRID_SPLIT_MIN,
  libtvGridSplitFromDimensions,
  libtvGridSplitFromPreset,
} from "@/lib/canvas/libtv-image-grid-split-dimensions";

describe("libtvGridSplitFromDimensions", () => {
  it("accepts custom cols × rows", () => {
    expect(libtvGridSplitFromDimensions(3, 6)).toEqual({
      cols: 3,
      rows: 6,
      selected: [],
    });
  });

  it("rejects out-of-range values", () => {
    expect(libtvGridSplitFromDimensions(0, 3)).toBeNull();
    expect(libtvGridSplitFromDimensions(3, LIBTV_GRID_SPLIT_MAX + 1)).toBeNull();
  });

  it("floors decimal input", () => {
    expect(libtvGridSplitFromDimensions(2.9, 3.1)?.cols).toBe(2);
    expect(libtvGridSplitFromDimensions(2.9, 3.1)?.rows).toBe(3);
  });
});

describe("libtvGridSplitFromPreset", () => {
  it("delegates to dimensions helper", () => {
    const split = libtvGridSplitFromPreset("4x4");
    expect(split.cols).toBe(4);
    expect(split.rows).toBe(4);
    expect(split.selected).toEqual([]);
  });

  it("min/max constants cover presets", () => {
    expect(LIBTV_GRID_SPLIT_MIN).toBeGreaterThanOrEqual(1);
    expect(LIBTV_GRID_SPLIT_MAX).toBeGreaterThanOrEqual(5);
  });
});

describe("gridSplitCropRegion", () => {
  it("maps 3×3 top-right cell (index 2) to landscape region", () => {
    const region = gridSplitCropRegion({
      sourceNodeId: "src",
      cols: 3,
      rows: 3,
      col: 2,
      row: 0,
    });
    expect(region.x).toBeCloseTo(2 / 3);
    expect(region.y).toBe(0);
    expect(region.w).toBeCloseTo(1 / 3);
    expect(region.h).toBeCloseTo(1 / 3);
    // 3×3 等分：单格在归一化坐标下为正方形；横屏感来自原图宽高比
    expect(region.w / region.h).toBeCloseTo(1);
  });
});
