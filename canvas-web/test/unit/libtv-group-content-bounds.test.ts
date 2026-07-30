import { describe, expect, it } from "vitest";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import {
  clampGroupBoxToBounds,
  computeGroupChildrenAbsBounds,
  computeLibtvGroupContentMinSize,
  expandLibtvGroupToFitChildren,
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
    expect(min.minWidth).toBeGreaterThanOrEqual(350 + 192 + 192);
    expect(min.minHeight).toBeGreaterThanOrEqual(350 + 112 + 192);
  });
});

describe("expandLibtvGroupToFitChildren", () => {
  it("grows group box without moving children", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: "g1",
        type: "group",
        position: { x: 10, y: 20 },
        width: 400,
        height: 300,
        data: { sbv1Styled: true },
      },
      {
        id: "render1",
        type: "jianying-auto-render-pro2",
        parentId: "g1",
        position: { x: 200, y: 100 },
        width: 635,
        height: 1100,
        data: { label: "自动成片" },
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
    const next = expandLibtvGroupToFitChildren(nodes, "g1");
    const group = next.find((n) => n.id === "g1")!;
    const render = next.find((n) => n.id === "render1")!;
    const img = next.find((n) => n.id === "img1")!;
    expect(group.width).toBeGreaterThan(400);
    expect(group.height).toBeGreaterThan(300);
    expect(render.position).toEqual({ x: 200, y: 100 });
    expect(img.position).toEqual({ x: 64, y: 112 });
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
      left: 200 - 192,
      top: 200 - 192 - 48,
      right: 300 + 192,
      bottom: 300 + 192,
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
