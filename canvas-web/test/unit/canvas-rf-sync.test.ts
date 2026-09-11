import { describe, expect, it } from "vitest";

import { mergeStoreNodesIntoRf } from "@/lib/canvas/canvas-rf-sync";
import { pickStoreToRfPosition } from "@/lib/canvas/canvas-rf-sync-position";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("pickStoreToRfPosition", () => {
  it("keeps RF drag position while parentId is unchanged", () => {
    expect(
      pickStoreToRfPosition({
        preserveRfPositions: true,
        rfParentId: "g1",
        storeParentId: "g1",
        rfPosition: { x: 120, y: 80 },
        storePosition: { x: 24, y: 16 },
      }),
    ).toEqual({ x: 120, y: 80 });
  });

  it("uses store absolute position when a child is reparented out of a group", () => {
    expect(
      pickStoreToRfPosition({
        preserveRfPositions: true,
        rfParentId: "g1",
        storeParentId: undefined,
        rfPosition: { x: 120, y: 80 },
        storePosition: { x: 520, y: 280 },
      }),
    ).toEqual({ x: 520, y: 280 });
  });
});

describe("mergeStoreNodesIntoRf", () => {
  it("preserves RF zIndex for pro2 media group children when store data changes", () => {
    const storeNodes: CanvasFlowNode[] = [
      {
        id: "g1",
        type: "group",
        position: { x: 0, y: 0 },
        data: { pro2Kind: "frame-board", pro2Styled: true },
        zIndex: 5,
      },
      {
        id: "f1",
        type: "story-pro2-image",
        parentId: "g1",
        position: { x: 40, y: 40 },
        data: { pro2MediaRole: "frame", gridSplitFrameCrop: true },
        zIndex: 22,
      },
    ];
    const rfNodes: CanvasFlowNode[] = [
      { ...storeNodes[0]!, selected: false, zIndex: 22 },
      {
        ...storeNodes[1]!,
        selected: true,
        zIndex: 1201,
        data: { pro2MediaRole: "frame" },
      },
    ];
    const merged = mergeStoreNodesIntoRf(rfNodes, storeNodes, {
      preserveRfSelection: true,
    });
    expect(merged[1]!.zIndex).toBe(1201);
    expect(merged[1]!.data).toBe(storeNodes[1]!.data);
  });

  it("preserves RF stretched size for selected node before store commit", () => {
    const storeNodes: CanvasFlowNode[] = [
      {
        id: "hub",
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        width: 420,
        height: 320,
        data: {},
      },
    ];
    const rfNodes: CanvasFlowNode[] = [
      {
        ...storeNodes[0]!,
        selected: true,
        width: 560,
        height: 400,
        style: { width: 560, height: 400 },
      },
    ];
    const merged = mergeStoreNodesIntoRf(rfNodes, storeNodes, {
      preserveRfSelection: true,
    });
    expect(merged[0]!.width).toBe(560);
    expect(merged[0]!.height).toBe(400);
  });
});
