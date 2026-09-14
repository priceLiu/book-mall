import { describe, expect, it } from "vitest";

import {
  applyLibtvMarqueeSelection,
  collectLibtvMarqueeNodeIds,
  libtvMarqueeNodeBox,
  userSelectionToFlowRect,
} from "@/lib/canvas/libtv-marquee-hit";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function node(
  id: string,
  patch: Partial<CanvasFlowNode> = {},
): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-image",
    position: { x: 0, y: 0 },
    data: {},
    ...patch,
  } as CanvasFlowNode;
}

describe("userSelectionToFlowRect", () => {
  it("converts pane pixels through RF transform", () => {
    expect(
      userSelectionToFlowRect(
        { x: 200, y: 100, width: 400, height: 200 },
        [100, 50, 2],
      ),
    ).toEqual({ x: 50, y: 25, w: 200, h: 100 });
  });
});

describe("libtvMarqueeNodeBox", () => {
  it("uses parent chain + explicit width/height, ignoring stale measured", () => {
    const group = node("g1", {
      type: "group",
      position: { x: 1000, y: 800 },
      width: 500,
      height: 400,
      measured: { width: 2000, height: 1600 },
    });
    const child = node("c1", {
      parentId: "g1",
      position: { x: 40, y: 30 },
      width: 200,
      height: 150,
      measured: { width: 900, height: 700 },
    });
    expect(libtvMarqueeNodeBox(child, [group, child])).toEqual({
      x: 1040,
      y: 830,
      w: 200,
      h: 150,
    });
    expect(libtvMarqueeNodeBox(group, [group, child])).toEqual({
      x: 1000,
      y: 800,
      w: 500,
      h: 400,
    });
  });
});

describe("collectLibtvMarqueeNodeIds", () => {
  const group = node("g1", {
    type: "group",
    position: { x: 100, y: 80 },
    width: 400,
    height: 300,
    measured: { width: 4000, height: 3000 },
  });
  const child = node("c1", {
    parentId: "g1",
    position: { x: 20, y: 20 },
    width: 120,
    height: 90,
  });
  const outsider = node("out", {
    position: { x: 2000, y: 2000 },
    width: 200,
    height: 150,
  });
  const nodes = [group, child, outsider];
  const identity: [number, number, number] = [0, 0, 1];

  it("does not select a distant node or the stale-measured group when the rect only covers the child", () => {
    const hits = collectLibtvMarqueeNodeIds(
      nodes,
      { x: 118, y: 98, width: 130, height: 100 },
      identity,
    );
    expect([...hits].sort()).toEqual(["c1"]);
  });

  it("selects the group only when the rect fully covers the visual group box", () => {
    const hits = collectLibtvMarqueeNodeIds(
      nodes,
      { x: 90, y: 70, width: 430, height: 330 },
      identity,
    );
    expect(hits.has("g1")).toBe(true);
    expect(hits.has("c1")).toBe(true);
    expect(hits.has("out")).toBe(false);
  });

  it("returns empty for a tiny click-sized rect", () => {
    expect(
      collectLibtvMarqueeNodeIds(
        nodes,
        { x: 10, y: 10, width: 1, height: 1 },
        identity,
      ).size,
    ).toBe(0);
  });

  it("skips unselectable nodes", () => {
    const locked = node("lock", {
      position: { x: 0, y: 0 },
      width: 80,
      height: 80,
      selectable: false,
    });
    const hits = collectLibtvMarqueeNodeIds(
      [locked],
      { x: -10, y: -10, width: 200, height: 200 },
      identity,
    );
    expect(hits.size).toBe(0);
  });
});

describe("applyLibtvMarqueeSelection", () => {
  it("keeps references when selection already matches", () => {
    const nodes = [
      node("a", { selected: true }),
      node("b", { selected: false }),
    ];
    expect(applyLibtvMarqueeSelection(nodes, new Set(["a"]))).toBe(nodes);
  });

  it("updates only changed selected flags", () => {
    const nodes = [
      node("a", { selected: false }),
      node("b", { selected: true }),
    ];
    const next = applyLibtvMarqueeSelection(nodes, new Set(["a"]));
    expect(next[0]!.selected).toBe(true);
    expect(next[1]!.selected).toBe(false);
    expect(next[1]).not.toBe(nodes[1]);
  });
});
