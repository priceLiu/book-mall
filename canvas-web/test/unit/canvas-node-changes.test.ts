import { describe, expect, it } from "vitest";
import type { NodeChange } from "@xyflow/react";
import {
  canvasNodesEqualIgnoringSelectionAndZ,
  canvasNodesLayoutFieldsEqual,
  canvasNodesSelectionAndZEqual,
  extractNodeRemoveChanges,
  extractResizeCommitIds,
  extractSelectNodeChanges,
  applyLibtvGroupResizeFrame,
  applyLibtvRfMeasurementEchoes,
  alignRfNodesMeasuredToBox,
  buildGroupResizeFrozenAbs,
  computeGroupCornerResize,
  extractGroupResizeRfChanges,
  filterLibtvRfChangesBeforeApply,
  resolveActiveResizeCommitIds,
  shouldFilterDimensionResizeCommit,
  trackNonGroupNodeResizeSession,
  filterStoreBoundNodeChanges,
  findGroupResizeSessionId,
  hasNodeRemoveChanges,
  isCanvasInternalDimensionsOnlyChange,
  isCanvasInteractiveGeometryInProgress,
  isCanvasRfLocalOnlyChange,
  isGroupResizeCommitFrame,
} from "@/lib/canvas/canvas-node-changes";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function node(
  id: string,
  patch: Partial<CanvasFlowNode> = {},
): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-image",
    position: { x: 0, y: 0 },
    data: { __t: "story-pro2-image" },
    ...patch,
  } as CanvasFlowNode;
}

describe("extractSelectNodeChanges", () => {
  it("keeps only select changes", () => {
    const changes: NodeChange[] = [
      { id: "a", type: "select", selected: true },
      { id: "b", type: "position", position: { x: 0, y: 0 } },
    ];
    expect(extractSelectNodeChanges(changes)).toEqual([
      { id: "a", type: "select", selected: true },
    ]);
  });
});

describe("canvasNodesSelectionAndZEqual", () => {
  it("returns true when selection and zIndex match", () => {
    const prev = [node("a", { selected: true, zIndex: 5 }), node("b")];
    const next = [
      node("a", { selected: true, zIndex: 5 }),
      node("b", { selected: false, zIndex: 0 }),
    ];
    expect(canvasNodesSelectionAndZEqual(prev, next)).toBe(true);
  });

  it("returns false when selection differs", () => {
    const prev = [node("a", { selected: true })];
    const next = [node("a", { selected: false })];
    expect(canvasNodesSelectionAndZEqual(prev, next)).toBe(false);
  });
});

describe("isCanvasInternalDimensionsOnlyChange", () => {
  it("detects RF internal dimension measurement batches", () => {
    const changes: NodeChange[] = [
      { type: "dimensions", id: "g1", dimensions: { width: 320, height: 240 } },
    ];
    expect(isCanvasInternalDimensionsOnlyChange(changes)).toBe(true);
  });

  it("rejects any dimensions change carrying a resizing flag", () => {
    const resizingStart: NodeChange[] = [
      {
        type: "dimensions",
        id: "g1",
        resizing: true,
        dimensions: { width: 320, height: 240 },
      },
    ];
    const resizingEnd: NodeChange[] = [
      {
        type: "dimensions",
        id: "g1",
        resizing: false,
        dimensions: { width: 320, height: 240 },
      },
    ];
    expect(isCanvasInternalDimensionsOnlyChange(resizingStart)).toBe(false);
    expect(isCanvasInternalDimensionsOnlyChange(resizingEnd)).toBe(false);
  });
});

describe("isCanvasInteractiveGeometryInProgress", () => {
  it("treats drag position mixed with RF measure dimensions as in-progress", () => {
    const changes: NodeChange[] = [
      {
        type: "position",
        id: "n1",
        dragging: true,
        position: { x: 10, y: 20 },
      },
      {
        type: "dimensions",
        id: "n1",
        dimensions: { width: 320, height: 240 },
      },
    ];
    expect(isCanvasInteractiveGeometryInProgress(changes)).toBe(true);
  });

  it("returns false for drag commit (dragging:false)", () => {
    const changes: NodeChange[] = [
      {
        type: "position",
        id: "n1",
        dragging: false,
        position: { x: 10, y: 20 },
      },
    ];
    expect(isCanvasInteractiveGeometryInProgress(changes)).toBe(false);
  });

  it("returns false for RF-local-only batches", () => {
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "n1",
        dimensions: { width: 320, height: 240 },
      },
    ];
    expect(isCanvasInteractiveGeometryInProgress(changes)).toBe(false);
  });
});

describe("applyLibtvRfMeasurementEchoes", () => {
  it("writes measured only (never width/height/style) for pure RF measurement echoes", () => {
    const nodes = [
      node("g1", {
        type: "group",
        width: 800,
        height: 600,
        style: { width: 800, height: 600 },
      }),
      node("c1", { parentId: "g1" }),
    ];
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "c1",
        dimensions: { width: 320, height: 240 },
      },
    ];
    const next = applyLibtvRfMeasurementEchoes(nodes, changes);
    expect(next).not.toBe(nodes);
    const child = next.find((n) => n.id === "c1")!;
    expect(child.measured).toEqual({ width: 320, height: 240 });
    expect(child.width).toBeUndefined();
    expect(child.style).toBeUndefined();
    // 未涉及的节点保持引用
    expect(next.find((n) => n.id === "g1")).toBe(nodes[0]);
  });

  it("ignores RO echo for nodes with explicit width/height (avoid measured fight on drag)", () => {
    const nodes = [
      node("img1", {
        width: 630,
        height: 354,
        style: { width: 630, height: 354 },
        measured: { width: 630, height: 354 },
      }),
    ];
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "img1",
        dimensions: { width: 354, height: 354 },
      },
    ];
    expect(applyLibtvRfMeasurementEchoes(nodes, changes)).toBe(nodes);
  });

  it("keeps node references when measured already matches", () => {
    const nodes = [
      node("c1", { measured: { width: 320, height: 240 } }),
    ];
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "c1",
        dimensions: { width: 320, height: 240 },
      },
    ];
    expect(applyLibtvRfMeasurementEchoes(nodes, changes)).toBe(nodes);
  });

  it("ignores user resize frames (resizing key), unknown ids and empty dimensions", () => {
    const nodes = [node("c1")];
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "c1",
        resizing: true,
        dimensions: { width: 400, height: 300 },
      },
      {
        type: "dimensions",
        id: "ghost",
        dimensions: { width: 100, height: 100 },
      },
      { type: "dimensions", id: "c1", dimensions: { width: 0, height: 0 } },
      { type: "select", id: "c1", selected: true },
    ];
    expect(applyLibtvRfMeasurementEchoes(nodes, changes)).toBe(nodes);
  });
});

describe("alignRfNodesMeasuredToBox", () => {
  it("overwrites stale measured with explicit width/height (group resize leftover)", () => {
    const nodes = [
      node("g1", {
        type: "group",
        width: 500,
        height: 400,
        style: { width: 500, height: 400 },
        measured: { width: 800, height: 600 },
      }),
    ];
    const next = alignRfNodesMeasuredToBox(nodes);
    expect(next).not.toBe(nodes);
    expect(next[0]!.measured).toEqual({ width: 500, height: 400 });
    expect(next[0]!.width).toBe(500);
  });

  it("stamps measured when width/height exist but measured is missing", () => {
    const nodes = [
      node("g1", {
        type: "group",
        width: 800,
        height: 600,
        style: { width: 800, height: 600 },
      }),
    ];
    expect(alignRfNodesMeasuredToBox(nodes)[0]!.measured).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("keeps references when measured already matches the box", () => {
    const nodes = [
      node("g1", {
        width: 320,
        height: 240,
        measured: { width: 320, height: 240 },
      }),
    ];
    expect(alignRfNodesMeasuredToBox(nodes)).toBe(nodes);
  });

  it("does not invent a box for nodes without width/height", () => {
    const nodes = [node("c1", { measured: { width: 320, height: 240 } })];
    expect(alignRfNodesMeasuredToBox(nodes)).toBe(nodes);
    expect(nodes[0]!.measured).toEqual({ width: 320, height: 240 });
  });
});

describe("filterLibtvRfChangesBeforeApply", () => {
  it("drops RF measurement dimensions but keeps select and user resize", () => {
    const measure: NodeChange[] = [
      { type: "select", id: "n1", selected: true },
      {
        type: "dimensions",
        id: "n1",
        dimensions: { width: 320, height: 240 },
      },
    ];
    expect(
      filterLibtvRfChangesBeforeApply(measure, {
        groupResizeUserActive: false,
        isGroupResizeCommit: false,
      }),
    ).toEqual([{ type: "select", id: "n1", selected: true }]);

    const resizing: NodeChange[] = [
      {
        type: "dimensions",
        id: "n1",
        resizing: false,
        dimensions: { width: 400, height: 300 },
      },
    ];
    expect(
      filterLibtvRfChangesBeforeApply(resizing, {
        groupResizeUserActive: false,
        isGroupResizeCommit: false,
        resizeCommitIds: ["n1"],
      }),
    ).toEqual(resizing);
  });

  it("strips position echo without dragging key", () => {
    const changes: NodeChange[] = [
      { type: "select", id: "c1", selected: true },
      { type: "position", id: "c1", position: { x: 12, y: 8 } },
    ];
    expect(
      filterLibtvRfChangesBeforeApply(changes, {
        groupResizeUserActive: false,
        isGroupResizeCommit: false,
      }),
    ).toEqual([{ type: "select", id: "c1", selected: true }]);
  });

  it("strips position dragging:false (LibTV drag commit uses onNodeDragStop)", () => {
    const changes: NodeChange[] = [
      { type: "select", id: "c1", selected: true },
      {
        type: "position",
        id: "c1",
        dragging: false,
        position: { x: 12, y: 8 },
      },
    ];
    expect(
      filterLibtvRfChangesBeforeApply(changes, {
        groupResizeUserActive: false,
        isGroupResizeCommit: false,
      }),
    ).toEqual([{ type: "select", id: "c1", selected: true }]);
  });

  it("keeps position dragging:true during drag", () => {
    const dragging: NodeChange[] = [
      {
        type: "position",
        id: "c1",
        dragging: true,
        position: { x: 12, y: 8 },
      },
    ];
    expect(
      filterLibtvRfChangesBeforeApply(dragging, {
        groupResizeUserActive: false,
        isGroupResizeCommit: false,
      }),
    ).toEqual(dragging);
  });

  it("keeps group position during active group corner resize", () => {
    const changes: NodeChange[] = [
      {
        type: "position",
        id: "g1",
        position: { x: 40, y: 32 },
      },
      {
        type: "dimensions",
        id: "g1",
        resizing: true,
        dimensions: { width: 420, height: 300 },
      },
    ];
    expect(
      filterLibtvRfChangesBeforeApply(changes, {
        groupResizeUserActive: true,
        isGroupResizeCommit: false,
        activeGroupResizeId: "g1",
      }),
    ).toEqual(changes);
  });
});

describe("computeGroupCornerResize", () => {
  const start = { x: 100, y: 80, w: 200, h: 120 };

  it("expands from bottom-right", () => {
    expect(
      computeGroupCornerResize("se", start, { x: 340, y: 240 }, 40, 40),
    ).toEqual({ x: 100, y: 80, w: 240, h: 160 });
  });

  it("expands from top-left and moves origin", () => {
    expect(
      computeGroupCornerResize("nw", start, { x: 80, y: 60 }, 40, 40),
    ).toEqual({ x: 80, y: 60, w: 220, h: 140 });
  });
});

describe("applyLibtvGroupResizeFrame", () => {
  it("left resize moves group origin and keeps children visually fixed", () => {
    const rfBeforeChange: CanvasFlowNode[] = [
      {
        id: "g1",
        type: "group",
        position: { x: 100, y: 80 },
        width: 400,
        height: 300,
        data: {},
      },
      {
        id: "c1",
        type: "story-pro2-image",
        parentId: "g1",
        position: { x: 28, y: 28 },
        width: 200,
        height: 150,
        data: {},
      },
    ];
    const frozen = buildGroupResizeFrozenAbs("g1", rfBeforeChange);
    const rfChanges: NodeChange[] = [
      { type: "position", id: "g1", position: { x: 60, y: 80 } },
      {
        type: "dimensions",
        id: "g1",
        resizing: true,
        dimensions: { width: 440, height: 300 },
      },
    ];
    const next = applyLibtvGroupResizeFrame(
      rfBeforeChange,
      rfChanges,
      "g1",
      frozen,
    );
    const group = next.find((n) => n.id === "g1");
    const child = next.find((n) => n.id === "c1");
    expect(group?.position).toEqual({ x: 60, y: 80 });
    expect(group?.width).toBe(440);
    // child abs was 128,80 → rel 68,28 after group x=60
    expect(child?.position).toEqual({ x: 68, y: 28 });
  });

  it("ignores XYResizer child compensation echoes", () => {
    const rfBeforeChange: CanvasFlowNode[] = [
      {
        id: "g1",
        type: "group",
        position: { x: 100, y: 80 },
        width: 400,
        height: 300,
        data: {},
      },
      {
        id: "c1",
        type: "story-pro2-image",
        parentId: "g1",
        position: { x: 28, y: 28 },
        width: 200,
        height: 150,
        data: {},
      },
    ];
    const frozen = buildGroupResizeFrozenAbs("g1", rfBeforeChange);
    const next = applyLibtvGroupResizeFrame(
      rfBeforeChange,
      [
        { type: "position", id: "g1", position: { x: 60, y: 80 } },
        {
          type: "dimensions",
          id: "g1",
          resizing: true,
          dimensions: { width: 440, height: 300 },
        },
        { type: "position", id: "c1", position: { x: 0, y: 0 } },
      ],
      "g1",
      frozen,
    );
    expect(next.find((n) => n.id === "c1")?.position).toEqual({ x: 68, y: 28 });
  });

  it("keeps node identities when resize changes are empty and measured already matches", () => {
    const rfBeforeChange: CanvasFlowNode[] = [
      {
        id: "g1",
        type: "group",
        position: { x: 100, y: 80 },
        width: 400,
        height: 300,
        measured: { width: 400, height: 300 },
        data: {},
      },
      {
        id: "c1",
        type: "story-pro2-image",
        parentId: "g1",
        extent: undefined,
        position: { x: 28, y: 28 },
        width: 200,
        height: 150,
        measured: { width: 200, height: 150 },
        data: {},
      },
    ];
    const frozen = buildGroupResizeFrozenAbs("g1", rfBeforeChange);
    const next = applyLibtvGroupResizeFrame(
      rfBeforeChange,
      [],
      "g1",
      frozen,
    );
    expect(next).toBe(rfBeforeChange);
  });
});

describe("extractGroupResizeRfChanges", () => {
  it("includes group position and dimensions but not child echoes", () => {
    const frozen = new Map([["c1", { x: 100, y: 80 }]]);
    const changes: NodeChange[] = [
      {
        type: "position",
        id: "g1",
        position: { x: 40, y: 32 },
      },
      {
        type: "dimensions",
        id: "g1",
        resizing: true,
        dimensions: { width: 420, height: 300 },
      },
      { type: "position", id: "c1", position: { x: 60, y: 48 } },
    ];
    expect(extractGroupResizeRfChanges(changes, "g1", frozen)).toEqual([
      changes[0],
      changes[1],
    ]);
  });
});

describe("filterStoreBoundNodeChanges", () => {
  it("strips mixed RF echo batches (select + measure + position echo)", () => {
    const changes: NodeChange[] = [
      { type: "select", id: "g1", selected: true },
      {
        type: "dimensions",
        id: "g1",
        dimensions: { width: 320, height: 240 },
      },
      { type: "position", id: "c1", position: { x: 12, y: 8 } },
    ];
    expect(filterStoreBoundNodeChanges(changes)).toEqual([]);
    expect(isCanvasRfLocalOnlyChange(changes)).toBe(true);
  });

  it("keeps user drag position commit with dragging:false", () => {
    const changes: NodeChange[] = [
      {
        type: "position",
        id: "c1",
        dragging: false,
        position: { x: 12, y: 8 },
      },
    ];
    expect(filterStoreBoundNodeChanges(changes)).toEqual(changes);
    expect(isCanvasRfLocalOnlyChange(changes)).toBe(false);
  });
});

describe("canvasNodesEqualIgnoringSelectionAndZ", () => {
  it("returns true when only selected/zIndex differ", () => {
    const prev = [
      node("a", { selected: false, zIndex: 5 }),
      node("b", { selected: true, zIndex: 22 }),
    ];
    const next = [
      node("a", { selected: true, zIndex: 1201 }),
      node("b", { selected: false, zIndex: 22 }),
    ];
    expect(canvasNodesEqualIgnoringSelectionAndZ(prev, next)).toBe(true);
  });

  it("returns false when data or layout differs", () => {
    const prev = [node("a", { width: 320 })];
    const next = [node("a", { width: 400 })];
    expect(canvasNodesEqualIgnoringSelectionAndZ(prev, next)).toBe(false);
  });
});

describe("canvasNodesLayoutFieldsEqual", () => {
  it("compares layout fields for given ids only", () => {
    const prev = [node("a", { width: 320, height: 240, position: { x: 1, y: 2 } })];
    const next = [node("a", { width: 320, height: 240, position: { x: 1, y: 2 } })];
    expect(canvasNodesLayoutFieldsEqual(prev, next, ["a"])).toBe(true);
  });
});

describe("findGroupResizeSessionId", () => {
  it("ignores ResizeObserver dimensions without resizing:true", () => {
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "g1",
        dimensions: { width: 400, height: 300 },
      },
    ];
    expect(findGroupResizeSessionId(changes, [{ id: "g1", type: "group" }])).toBe(
      null,
    );
  });

  it("starts session on resizing:true", () => {
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "g1",
        resizing: true,
        dimensions: { width: 400, height: 300 },
      },
    ];
    expect(findGroupResizeSessionId(changes, [{ id: "g1", type: "group" }])).toBe(
      "g1",
    );
  });
});

describe("resolveActiveResizeCommitIds", () => {
  it("commits non-group node resize when session is active", () => {
    const session = new Set<string>();
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "n1",
        resizing: false,
        dimensions: { width: 400, height: 300 },
      },
    ];
    trackNonGroupNodeResizeSession(
      [
        {
          type: "dimensions",
          id: "n1",
          resizing: true,
          dimensions: { width: 380, height: 280 },
        },
      ],
      [{ id: "n1", type: "story-pro2-image" }],
      session,
    );
    expect(
      resolveActiveResizeCommitIds(changes, [{ id: "n1", type: "story-pro2-image" }], {
        groupResizeUserActive: false,
        nodeResizeSession: session,
      }),
    ).toEqual(["n1"]);
  });

  it("ignores non-group resize commit without session", () => {
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "n1",
        resizing: false,
        dimensions: { width: 400, height: 300 },
      },
    ];
    expect(
      resolveActiveResizeCommitIds(changes, [{ id: "n1", type: "story-pro2-image" }], {
        groupResizeUserActive: false,
        nodeResizeSession: new Set(),
      }),
    ).toEqual([]);
  });

  it("commits group resize only when group session is active", () => {
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "g1",
        resizing: false,
        dimensions: { width: 400, height: 300 },
      },
    ];
    expect(
      resolveActiveResizeCommitIds(changes, [{ id: "g1", type: "group" }], {
        groupResizeUserActive: true,
        nodeResizeSession: new Set(),
      }),
    ).toEqual(["g1"]);
    expect(
      resolveActiveResizeCommitIds(changes, [{ id: "g1", type: "group" }], {
        groupResizeUserActive: false,
        nodeResizeSession: new Set(),
      }),
    ).toEqual([]);
  });
});

describe("shouldFilterDimensionResizeCommit", () => {
  it("filters inactive dimension commits", () => {
    const change: NodeChange = {
      type: "dimensions",
      id: "n1",
      resizing: false,
      dimensions: { width: 400, height: 300 },
    };
    expect(shouldFilterDimensionResizeCommit(change, new Set())).toBe(true);
    expect(shouldFilterDimensionResizeCommit(change, new Set(["n1"]))).toBe(
      false,
    );
  });
});

describe("isGroupResizeCommitFrame", () => {
  it("does not commit on dimensions-only intermediate frames", () => {
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "g1",
        dimensions: { width: 400, height: 300 },
      },
    ];
    expect(extractResizeCommitIds(changes)).toEqual([]);
    expect(
      isGroupResizeCommitFrame(changes, "g1", extractResizeCommitIds(changes)),
    ).toBe(false);
  });

  it("commits when resizing:false is present", () => {
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "g1",
        resizing: false,
        dimensions: { width: 400, height: 300 },
      },
    ];
    const commitIds = extractResizeCommitIds(changes);
    expect(isGroupResizeCommitFrame(changes, "g1", commitIds)).toBe(true);
  });

  it("does not commit while resizing:true", () => {
    const changes: NodeChange[] = [
      {
        type: "dimensions",
        id: "g1",
        resizing: true,
        dimensions: { width: 400, height: 300 },
      },
    ];
    expect(
      isGroupResizeCommitFrame(changes, "g1", extractResizeCommitIds(changes)),
    ).toBe(false);
  });
});

describe("hasNodeRemoveChanges", () => {
  it("detects remove changes", () => {
    expect(
      hasNodeRemoveChanges([
        { type: "select", id: "a", selected: true },
        { type: "remove", id: "b" },
      ]),
    ).toBe(true);
  });

  it("returns false for geometry-only batches", () => {
    expect(
      hasNodeRemoveChanges([
        { type: "position", id: "a", position: { x: 1, y: 2 }, dragging: false },
      ]),
    ).toBe(false);
  });
});

describe("extractNodeRemoveChanges", () => {
  it("filters only remove entries", () => {
    const changes: NodeChange[] = [
      { type: "select", id: "a", selected: true },
      { type: "remove", id: "b" },
      { type: "remove", id: "c" },
    ];
    expect(extractNodeRemoveChanges(changes).map((c) => c.id)).toEqual([
      "b",
      "c",
    ]);
  });
});
