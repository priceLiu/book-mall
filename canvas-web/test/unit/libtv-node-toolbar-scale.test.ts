import { describe, expect, it } from "vitest";
import {
  computeLibtvNodeToolbarTransformScale,
  LIBTV_NODE_TOOLBAR_MAX_SCALE,
  LIBTV_NODE_TOOLBAR_MIN_SCALE,
} from "@/lib/canvas/libtv-node-toolbar-scale";

describe("computeLibtvNodeToolbarTransformScale", () => {
  it("is 1 at zoom 1 (on-screen 1x)", () => {
    expect(computeLibtvNodeToolbarTransformScale(1)).toBeCloseTo(1, 5);
  });

  it("fully compensates so on-screen size stays constant", () => {
    // on-screen size ≈ zoom × scale; full compensation keeps it ≈ 1
    for (const z of [0.2, 0.5, 0.8]) {
      const scale = computeLibtvNodeToolbarTransformScale(z);
      expect(z * scale).toBeCloseTo(1, 5);
    }
  });

  it("reaches 10x at 10% zoom (= 100% on-screen size)", () => {
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
