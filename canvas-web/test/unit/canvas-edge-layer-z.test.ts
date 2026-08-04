import { describe, expect, it } from "vitest";

import {
  CANVAS_EDGE_Z_BEHIND_GROUP,
  CANVAS_EDGE_Z_DEFAULT,
  CANVAS_EDGE_Z_NODE_GAP,
  isEdgeCrossingGroupBoundary,
  isEdgeInternalToGroup,
  isEdgeInternalToStyledMediaGroup,
  isEdgeTouchingGroupedNode,
  resolveLibtvCanvasEdgeZIndex,
} from "@/lib/canvas/canvas-edge-layer-z";

describe("canvas-edge-layer-z", () => {
  const group = {
    id: "g1",
    type: "group",
    position: { x: 0, y: 0 },
    data: { pro2Styled: true },
  };
  const img = {
    id: "img1",
    type: "sbv1-image",
    parentId: "g1",
    position: { x: 0, y: 0 },
    data: {},
  };
  const vid = {
    id: "vid1",
    type: "sbv1-video-engine",
    parentId: "g1",
    position: { x: 200, y: 0 },
    data: {},
  };
  const outside = {
    id: "out1",
    type: "story-pro2-starter",
    position: { x: 900, y: 0 },
    data: {},
  };
  const nodes = [group, img, vid, outside];

  it("detects in-group edges for any group", () => {
    expect(
      isEdgeInternalToGroup({ source: "img1", target: "vid1" }, nodes),
    ).toBe(true);
    expect(
      isEdgeInternalToStyledMediaGroup(
        { source: "img1", target: "vid1" },
        nodes,
      ),
    ).toBe(true);
  });

  it("detects cross-group boundaries", () => {
    expect(
      isEdgeCrossingGroupBoundary({ source: "out1", target: "vid1" }, nodes),
    ).toBe(true);
    expect(
      isEdgeCrossingGroupBoundary({ source: "img1", target: "vid1" }, nodes),
    ).toBe(false);
  });

  it("puts cross-group edges on node-gap layer (not behind group shell)", () => {
    const edge = { id: "e1", source: "out1", target: "vid1" };
    expect(resolveLibtvCanvasEdgeZIndex(edge, nodes, null)).toBe(
      CANVAS_EDGE_Z_NODE_GAP,
    );
  });

  it("keeps in-group edges on node-gap layer", () => {
    const edge = { id: "e2", source: "img1", target: "vid1" };
    expect(resolveLibtvCanvasEdgeZIndex(edge, nodes, null)).toBe(
      CANVAS_EDGE_Z_NODE_GAP,
    );
  });

  it("marks grouped touch helpers", () => {
    expect(
      isEdgeTouchingGroupedNode({ source: "img1", target: "vid1" }, nodes),
    ).toBe(true);
    expect(
      isEdgeCrossingGroupBoundary({ source: "out1", target: "vid1" }, nodes),
    ).toBe(true);
  });

  it("keeps fully outside edges at default layer", () => {
    const out2 = {
      id: "out2",
      type: "story-pro2-starter",
      position: { x: 1200, y: 0 },
      data: {},
    };
    const edge = { id: "e3", source: "out1", target: "out2" };
    expect(
      resolveLibtvCanvasEdgeZIndex(edge, [...nodes, out2], null),
    ).toBe(CANVAS_EDGE_Z_DEFAULT);
  });
});
