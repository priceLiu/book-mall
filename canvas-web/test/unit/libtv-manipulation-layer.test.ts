import { describe, expect, it } from "vitest";
import {
  applyLibtvManipulationLayerToNodes,
  CANVAS_Z_CHILD_MANIPULATION,
  CANVAS_Z_DRAGGED_TOP,
  CANVAS_Z_GROUP_MANIPULATION,
  edgeInManipulationBundle,
  LIBTV_MANIPULATION_ACTIVE_CLASS,
  resolveActiveManipulationGroupIds,
  sortLibtvNodesWithDraggingLast,
} from "@/lib/canvas/libtv-manipulation-layer";
import { bumpLibtvGroupRenderOrderToFront } from "@/lib/canvas/normalize-graph-nodes";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

function group(id: string, extra?: Partial<CanvasFlowNode>): CanvasFlowNode {
  return {
    id,
    type: "group",
    position: { x: 0, y: 0 },
    data: { pro2ShortcutPreset: "text-to-video", label: "g" },
    ...extra,
  } as CanvasFlowNode;
}

function child(
  id: string,
  parentId: string,
  extra?: Partial<CanvasFlowNode>,
): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-starter",
    parentId,
    position: { x: 10, y: 10 },
    data: {},
    ...extra,
  } as CanvasFlowNode;
}

describe("libtv-manipulation-layer", () => {
  it("expands active bundle when a child is selected", () => {
    const nodes = [
      group("g1"),
      child("c1", "g1", { selected: true }),
      child("c2", "g1"),
    ];
    expect(resolveActiveManipulationGroupIds(nodes)).toEqual(new Set(["g1"]));
    const next = applyLibtvManipulationLayerToNodes(nodes);
    expect(next.find((n) => n.id === "g1")?.zIndex).toBe(
      CANVAS_Z_GROUP_MANIPULATION,
    );
    expect(next.find((n) => n.id === "c1")?.zIndex).toBe(
      CANVAS_Z_CHILD_MANIPULATION,
    );
    expect(next.find((n) => n.id === "c2")?.zIndex).toBe(
      CANVAS_Z_CHILD_MANIPULATION,
    );
    expect(
      (next.find((n) => n.id === "g1") as { className?: string }).className,
    ).toContain(LIBTV_MANIPULATION_ACTIVE_CLASS);
  });

  it("treats draggingNodeIds like selection for the whole group", () => {
    const nodes = [group("g1"), child("c1", "g1"), child("c2", "g1")];
    const active = resolveActiveManipulationGroupIds(nodes, {
      draggingNodeIds: ["c2"],
    });
    expect(active).toEqual(new Set(["g1"]));
    const next = applyLibtvManipulationLayerToNodes(nodes, {
      draggingNodeIds: ["c2"],
    });
    expect(next.find((n) => n.id === "c2")?.zIndex).toBe(CANVAS_Z_DRAGGED_TOP);
  });

  it("elevates hover drop-target group while dragging a root image", () => {
    const nodes = [
      group("g1"),
      child("c1", "g1"),
      {
        id: "img",
        type: "story-pro2-image",
        position: { x: 400, y: 0 },
        data: {},
      } as CanvasFlowNode,
    ];
    const active = resolveActiveManipulationGroupIds(nodes, {
      draggingNodeIds: ["img"],
      hoverGroupIds: ["g1"],
    });
    expect(active).toEqual(new Set(["g1"]));
    const next = applyLibtvManipulationLayerToNodes(nodes, {
      draggingNodeIds: ["img"],
      hoverGroupIds: ["g1"],
    });
    expect(next.find((n) => n.id === "img")?.zIndex).toBe(CANVAS_Z_DRAGGED_TOP);
    expect(next.find((n) => n.id === "c1")?.zIndex).toBe(
      CANVAS_Z_CHILD_MANIPULATION,
    );
  });

  it("bumps a group and its children to the end of RF draw order", () => {
    const g1 = group("g1");
    const g2 = group("g2");
    const nodes = [
      g1,
      g2,
      child("a1", "g1"),
      child("b1", "g2"),
    ];
    const next = bumpLibtvGroupRenderOrderToFront(nodes, "g1");
    const groups = next.filter((n) => n.type === "group").map((n) => n.id);
    expect(groups[groups.length - 1]).toBe("g1");
    const children = next
      .filter((n) => n.type !== "group")
      .map((n) => n.id);
    expect(children[children.length - 1]).toBe("a1");
  });

  it("does not reorder nodes when dragging a group (parent must stay before children)", () => {
    const nodes = [group("g1"), child("c1", "g1")];
    const sorted = sortLibtvNodesWithDraggingLast(nodes, ["g1"]);
    expect(sorted.map((n) => n.id)).toEqual(["g1", "c1"]);
  });

  it("uses group shell z below children when the group itself is dragged", () => {
    const nodes = [group("g1"), child("c1", "g1")];
    const next = applyLibtvManipulationLayerToNodes(nodes, {
      draggingNodeIds: ["g1"],
    });
    expect(next.find((n) => n.id === "g1")?.zIndex).toBe(
      CANVAS_Z_GROUP_MANIPULATION,
    );
    expect(next.find((n) => n.id === "c1")?.zIndex).toBe(
      CANVAS_Z_CHILD_MANIPULATION,
    );
  });

  it("elevates edges touching the manipulation bundle", () => {
    const nodes = [group("g1"), child("c1", "g1", { selected: true })];
    const edge: CanvasFlowEdge = {
      id: "e1",
      source: "c1",
      target: "out",
    };
    expect(edgeInManipulationBundle(edge, nodes)).toBe(true);
  });
});
