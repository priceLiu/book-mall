import { describe, expect, it } from "vitest";

import {
  migratePro2HubMediaGroupEdgesToChildren,
  stripSpuriousPro2HubTextEdges,
} from "@/lib/canvas/pro2-hub-media-group-edge";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

describe("stripSpuriousPro2HubTextEdges", () => {
  const sourceImage: CanvasFlowNode = {
    id: "n_src",
    type: "story-pro2-image",
    position: { x: 0, y: 0 },
    data: {},
  };
  const child: CanvasFlowNode = {
    id: "n_child",
    type: "story-pro2-image",
    parentId: "g1",
    position: { x: 0, y: 0 },
    data: {},
  };
  const group: CanvasFlowNode = {
    id: "g1",
    type: "group",
    position: { x: 0, y: 0 },
    data: { pro2Kind: "frame-board", pro2HubNodeId: "n_src" },
  };
  const nodes = [sourceImage, group, child];

  it("removes text→in_image when image→in_image already exists from non-script hub", () => {
    const edges: CanvasFlowEdge[] = [
      {
        id: "e-img",
        source: "n_src",
        target: "n_child",
        sourceHandle: "image",
        targetHandle: "in_image",
      },
      {
        id: "e-text",
        source: "n_src",
        target: "n_child",
        sourceHandle: "text",
        targetHandle: "in_image",
      },
    ];
    const next = stripSpuriousPro2HubTextEdges(nodes, edges);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe("e-img");
  });

  it("keeps text→in_image from script hub", () => {
    const hub: CanvasFlowNode = {
      id: "n_hub",
      type: "story-pro2-script-hub",
      position: { x: 0, y: 0 },
      data: {},
    };
    const hubNodes = [hub, group, child];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e-text",
        source: "n_hub",
        target: "n_child",
        sourceHandle: "text",
        targetHandle: "in_image",
      },
    ];
    expect(stripSpuriousPro2HubTextEdges(hubNodes, edges)).toHaveLength(1);
  });
});

describe("migratePro2HubMediaGroupEdgesToChildren", () => {
  it("does not add hub text edges when group pro2HubNodeId is a source image", () => {
    const sourceImage: CanvasFlowNode = {
      id: "n_src",
      type: "story-pro2-image",
      position: { x: 0, y: 0 },
      data: {},
    };
    const child: CanvasFlowNode = {
      id: "n_child",
      type: "story-pro2-image",
      parentId: "g1",
      position: { x: 0, y: 0 },
      data: {},
    };
    const group: CanvasFlowNode = {
      id: "g1",
      type: "group",
      position: { x: 0, y: 0 },
      data: { pro2Kind: "frame-board", pro2HubNodeId: "n_src", pro2Styled: true },
    };
    const nodes = [sourceImage, group, child];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e-img",
        source: "n_src",
        target: "n_child",
        sourceHandle: "image",
        targetHandle: "in_image",
      },
      {
        id: "e-text",
        source: "n_src",
        target: "n_child",
        sourceHandle: "text",
        targetHandle: "in_image",
      },
    ];
    const next = migratePro2HubMediaGroupEdgesToChildren(nodes, edges);
    expect(next).toHaveLength(1);
    expect(next[0]?.sourceHandle).toBe("image");
  });
});
