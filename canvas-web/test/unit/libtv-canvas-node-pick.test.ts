import { describe, expect, it } from "vitest";
import {
  pickLibtvCanvasNodeAtClientPoint,
  pickLibtvCanvasNodeFromElementStack,
} from "@/lib/canvas/libtv-canvas-node-pick";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function node(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  z = 0,
): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-script-hub",
    position: { x, y },
    width: w,
    height: h,
    zIndex: z,
    data: {},
  } as CanvasFlowNode;
}

function mockStackEl(
  nodeId: string | null,
  opts?: { group?: boolean },
): Element {
  const el = {
    closest(selector: string) {
      if (selector !== ".react-flow__node") return null;
      if (!nodeId) return null;
      return {
        classList: { contains: (c: string) => opts?.group && c === "react-flow__node-group" },
        dataset: { id: nodeId, type: opts?.group ? "group" : undefined },
      } as unknown as HTMLElement;
    },
  };
  return el as unknown as Element;
}

describe("pickLibtvCanvasNodeFromElementStack", () => {
  it("returns topmost react-flow node in the stack", () => {
    const dock = mockStackEl(null);
    const nodeEl = mockStackEl("target");
    const picked = pickLibtvCanvasNodeFromElementStack([dock, nodeEl]);
    expect(picked).toBe("target");
  });

  it("skips group nodes", () => {
    const group = mockStackEl("group-1", { group: true });
    const nodeEl = mockStackEl("child");
    const picked = pickLibtvCanvasNodeFromElementStack([group, nodeEl]);
    expect(picked).toBe("child");
  });
});

describe("pickLibtvCanvasNodeAtClientPoint", () => {
  it("returns topmost node at flow coordinates", () => {
    const nodes = [
      node("low", 0, 0, 200, 200, 1),
      node("high", 50, 50, 200, 200, 5),
    ];
    const picked = pickLibtvCanvasNodeAtClientPoint(
      0,
      0,
      nodes,
      () => ({ x: 100, y: 100 }),
    );
    expect(picked).toBe("high");
  });

  it("returns null when no node contains the point", () => {
    const nodes = [node("a", 0, 0, 100, 100)];
    const picked = pickLibtvCanvasNodeAtClientPoint(
      0,
      0,
      nodes,
      () => ({ x: 500, y: 500 }),
    );
    expect(picked).toBeNull();
  });
});
