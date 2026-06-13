import { describe, expect, it } from "vitest";
import { packNodesInGrid } from "@/lib/canvas/canvas-reflow-pack";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function node(id: string, w: number, h: number): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-image",
    position: { x: 9999, y: 9999 },
    data: {},
    width: w,
    height: h,
  } as CanvasFlowNode;
}

describe("packNodesInGrid", () => {
  it("wraps into multiple rows with maxCols", () => {
    const nodes = [node("a", 100, 80), node("b", 100, 80), node("c", 100, 80)];
    const positions = packNodesInGrid(nodes, ["a", "b", "c"], {
      startY: 200,
      maxCols: 2,
      colGap: 10,
      rowGap: 20,
    });
    expect(positions.get("a")).toEqual({ x: 120, y: 200 });
    expect(positions.get("b")).toEqual({ x: 230, y: 200 });
    expect(positions.get("c")).toEqual({ x: 120, y: 300 });
  });
});
