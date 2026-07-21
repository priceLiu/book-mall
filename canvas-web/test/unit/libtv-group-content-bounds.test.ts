import { describe, expect, it } from "vitest";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import {
  clampGroupBoxToBounds,
  computeGroupChildrenAbsBounds,
  computeLibtvGroupContentMinSize,
  resolveGroupResizeGeometry,
} from "@/lib/canvas/libtv-group-content-bounds";

describe("computeLibtvGroupContentMinSize", () => {
  it("wraps child nodes with LibTV group padding", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: "g1",
        type: "group",
        position: { x: 0, y: 0 },
        data: { sbv1Styled: true },
      },
      {
        id: "img1",
        type: "sbv1-image",
        parentId: "g1",
        position: { x: 64, y: 112 },
        width: 350,
        height: 350,
        data: {},
      },
    ];
    const min = computeLibtvGroupContentMinSize("g1", nodes);
    expect(min.minWidth).toBeGreaterThanOrEqual(350 + 64 + 64);
    expect(min.minHeight).toBeGreaterThanOrEqual(350 + 112 + 64);
  });
});

describe("resolveGroupResizeGeometry", () => {
  const snapshot = {
    position: { x: 0, y: 0 },
    width: 800,
    height: 600,
  };

  it("reverts to snapshot when proposed is below content min", () => {
    const result = resolveGroupResizeGeometry(
      { position: { x: 0, y: 0 }, width: 300, height: 200 },
      { minWidth: 700, minHeight: 500 },
      snapshot,
    );
    expect(result).toEqual(snapshot);
  });

  it("clamps proposed size up to content min", () => {
    const result = resolveGroupResizeGeometry(
      { position: { x: 0, y: 0 }, width: 750, height: 520 },
      { minWidth: 700, minHeight: 500 },
      snapshot,
    );
    expect(result.width).toBe(750);
    expect(result.height).toBe(520);
  });
});

describe("computeGroupChildrenAbsBounds", () => {
  const nodes: CanvasFlowNode[] = [
    {
      id: "img1",
      type: "sbv1-image",
      parentId: "g1",
      position: { x: 0, y: 0 },
      width: 100,
      height: 100,
      data: {},
    },
  ];

  it("expands each edge by LibTV padding (top also by header)", () => {
    const frozen = new Map([["img1", { x: 200, y: 200 }]]);
    const bounds = computeGroupChildrenAbsBounds(frozen, nodes);
    expect(bounds).toEqual({
      left: 200 - 64,
      top: 200 - 64 - 48,
      right: 300 + 64,
      bottom: 300 + 64,
    });
  });

  it("returns null when no matching children", () => {
    const frozen = new Map([["missing", { x: 0, y: 0 }]]);
    expect(computeGroupChildrenAbsBounds(frozen, nodes)).toBeNull();
  });
});

describe("clampGroupBoxToBounds (per-edge)", () => {
  const bounds = { left: 136, top: 88, right: 364, bottom: 364 };

  it("keeps a box that already encloses content unchanged", () => {
    const result = clampGroupBoxToBounds(
      { position: { x: 0, y: 0 }, width: 500, height: 500 },
      bounds,
    );
    expect(result).toEqual({
      position: { x: 0, y: 0 },
      width: 500,
      height: 500,
    });
  });

  it("snaps only the dragged left edge back, right edge stays put", () => {
    // 用户把左边往右拖切进内容：left 收回内容边界，right 保持 450 不动
    const result = clampGroupBoxToBounds(
      { position: { x: 250, y: 0 }, width: 200, height: 500 },
      bounds,
    );
    expect(result.position.x).toBe(136);
    expect(result.position.x + result.width).toBe(450);
    expect(result.position.y).toBe(0);
    expect(result.position.y + result.height).toBe(500);
  });
});
