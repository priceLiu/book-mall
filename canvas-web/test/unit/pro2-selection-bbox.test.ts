import { describe, expect, it } from "vitest";

import {
  computePro2MultiSelectionBbox,
  pro2NodeAbsolutePosition,
} from "@/lib/canvas/pro2-selection-bbox";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("computePro2MultiSelectionBbox", () => {
  it("uses positionAbsolute for grouped children, not relative position", () => {
    const groupId = "group-1";
    const childId = "img-1";
    const nodes: CanvasFlowNode[] = [
      {
        id: groupId,
        type: "group",
        position: { x: 1000, y: 200 },
        data: {},
        width: 800,
        height: 600,
      },
      {
        id: childId,
        type: "story-pro2-image",
        parentId: groupId,
        position: { x: 40, y: 60 },
        data: {},
        width: 240,
        height: 320,
      },
    ];

    const child2Id = "img-2";
    nodes.push({
      id: child2Id,
      type: "story-pro2-image",
      parentId: groupId,
      position: { x: 300, y: 60 },
      data: {},
      width: 240,
      height: 320,
    });

    const bbox = computePro2MultiSelectionBbox(
      [childId, child2Id],
      nodes,
      (id) =>
        id === childId
          ? ({
              position: { x: 40, y: 60 },
              measured: { width: 240, height: 320 },
              width: 240,
              height: 320,
            } as never)
          : ({
              internals: { positionAbsolute: { x: 1300, y: 260 } },
              measured: { width: 240, height: 320 },
              width: 240,
              height: 320,
            } as never),
    );

    expect(bbox).not.toBeNull();
    expect(bbox!.x).toBe(1040);
    expect(bbox!.y).toBe(260);
    expect(bbox!.x2).toBe(1300 + 240);
    expect(bbox!.y2).toBe(260 + 320);
  });

  it("falls back to parent-chain absolute position when internals missing", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: "group-1",
        type: "group",
        position: { x: 500, y: 100 },
        data: {},
      },
      {
        id: "img-2",
        type: "story-pro2-image",
        parentId: "group-1",
        position: { x: 10, y: 20 },
        data: {},
        width: 200,
        height: 300,
      },
    ];

    const abs = pro2NodeAbsolutePosition(nodes[1]!, nodes);
    expect(abs).toEqual({ x: 510, y: 120 });

    nodes.push({
      id: "img-3",
      type: "story-pro2-image",
      parentId: "group-1",
      position: { x: 280, y: 20 },
      data: {},
      width: 200,
      height: 300,
    });

    const bbox = computePro2MultiSelectionBbox(
      ["img-2", "img-3"],
      nodes,
      () => undefined,
    );
    expect(bbox).toEqual({
      x: 510,
      y: 120,
      x2: 980,
      y2: 420,
    });
  });
});
