import { describe, expect, it } from "vitest";
import type { NodeChange } from "@xyflow/react";
import {
  canvasNodesLayoutFieldsEqual,
  canvasNodesSelectionAndZEqual,
  extractNodeRemoveChanges,
  extractResizeCommitIds,
  extractSelectNodeChanges,
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
