import { describe, expect, it } from "vitest";
import { computeDragSnap, nodeSnapBox } from "@/lib/canvas/canvas-drag-snap";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("computeDragSnap", () => {
  it("snaps left edges within threshold", () => {
    const dragging = {
      id: "a",
      left: 102,
      right: 202,
      top: 50,
      bottom: 150,
      centerX: 152,
      centerY: 100,
    };
    const others = [
      {
        id: "b",
        left: 100,
        right: 300,
        top: 400,
        bottom: 500,
        centerX: 200,
        centerY: 450,
      },
    ];
    const { dx, guides } = computeDragSnap(dragging, others, 6);
    expect(dx).toBe(-2);
    expect(guides.some((g) => g.orientation === "vertical")).toBe(true);
  });

  it("snaps top edges within threshold", () => {
    const dragging = {
      id: "a",
      left: 50,
      right: 150,
      top: 102,
      bottom: 202,
      centerX: 100,
      centerY: 152,
    };
    const others = [
      {
        id: "b",
        left: 400,
        right: 500,
        top: 100,
        bottom: 200,
        centerX: 450,
        centerY: 150,
      },
    ];
    const { dy, guides } = computeDragSnap(dragging, others, 6);
    expect(dy).toBe(-2);
    expect(guides.some((g) => g.orientation === "horizontal")).toBe(true);
  });
});

describe("nodeSnapBox", () => {
  it("uses absolute position with parent chain", () => {
    const nodes = [
      {
        id: "g",
        type: "group",
        position: { x: 100, y: 100 },
        data: {},
        width: 400,
        height: 300,
      },
      {
        id: "c",
        type: "story-pro2-image",
        parentId: "g",
        position: { x: 20, y: 40 },
        data: {},
        width: 120,
        height: 80,
      },
    ] as CanvasFlowNode[];
    const box = nodeSnapBox(nodes[1]!, nodes);
    expect(box.left).toBe(120);
    expect(box.top).toBe(140);
  });
});
