import { describe, expect, it } from "vitest";
import {
  PRO2_MEDIA_GRID_GAP,
  PRO2_MEDIA_GRID_GAP_Y,
  mediaGridLayoutForChildren,
  pro2MediaGridCols,
  pro2MediaGridGap,
} from "@/lib/canvas/pro2-media-group-layout";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function stubNode(id: string, w: number, h: number): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-image",
    position: { x: 0, y: 0 },
    data: {},
    width: w,
    height: h,
  };
}

describe("pro2MediaGridGap", () => {
  it("returns fixed gap regardless of cell width", () => {
    expect(pro2MediaGridGap(320)).toBe(PRO2_MEDIA_GRID_GAP);
    expect(pro2MediaGridGap(630)).toBe(PRO2_MEDIA_GRID_GAP);
    expect(pro2MediaGridGap(1200)).toBe(PRO2_MEDIA_GRID_GAP);
  });
});

describe("pro2MediaGridCols", () => {
  it("derives column count from child count", () => {
    expect(pro2MediaGridCols(7)).toBe(4);
    expect(pro2MediaGridCols(9)).toBe(3);
  });
});

describe("mediaGridLayoutForChildren", () => {
  it("uses fixed gap between cells", () => {
    const children = [
      stubNode("a", 300, 200),
      stubNode("b", 300, 200),
      stubNode("c", 300, 200),
    ];
    const layouts = mediaGridLayoutForChildren(children, 3, (n) => ({
      width: n.width!,
      height: n.height!,
    }));
    expect(layouts[1]!.x - layouts[0]!.x).toBe(300 + PRO2_MEDIA_GRID_GAP);
  });

  it("uses tighter vertical gap between rows", () => {
    const children = [
      stubNode("a", 300, 200),
      stubNode("b", 300, 200),
      stubNode("c", 300, 200),
      stubNode("d", 300, 200),
    ];
    const layouts = mediaGridLayoutForChildren(children, 2, (n) => ({
      width: n.width!,
      height: n.height!,
    }));
    expect(layouts[2]!.y - layouts[0]!.y).toBe(200 + PRO2_MEDIA_GRID_GAP_Y);
  });
});
