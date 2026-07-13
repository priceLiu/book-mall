import { describe, expect, it } from "vitest";

import { duplicateMediaGroupInGraph } from "@/lib/canvas/duplicate-media-group";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

describe("duplicateMediaGroupInGraph", () => {
  it("remaps internal edges and clears in-flight runtime on children", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: "g1",
        type: "group",
        position: { x: 0, y: 0 },
        width: 400,
        data: { label: "组 A", pro2HubNodeId: "hub1" },
      },
      {
        id: "img1",
        type: "sbv1-image",
        parentId: "g1",
        position: { x: 10, y: 10 },
        data: {
          ossUrl: "https://example.com/a.png",
          runtime: { status: "done", ossUrl: "https://example.com/a.png" },
        },
      },
      {
        id: "vid1",
        type: "sbv1-video-engine",
        parentId: "g1",
        position: { x: 200, y: 10 },
        data: {
          prompt: "walk",
          runtime: { status: "running", taskId: "task_abc" },
        },
      },
      {
        id: "hub1",
        type: "story-pro2-starter",
        position: { x: -200, y: 0 },
        data: {},
      },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "e1", source: "img1", target: "vid1", targetHandle: "in_ref" },
      { id: "e2", source: "hub1", target: "g1" },
    ];

    const result = duplicateMediaGroupInGraph("g1", nodes, edges);
    expect(result).not.toBeNull();
    if (!result) return;

    const newGroupId = result.newGroupId;
    const newImg = result.nodes.find(
      (n) => n.parentId === newGroupId && n.type === "sbv1-image",
    );
    const newVid = result.nodes.find(
      (n) => n.parentId === newGroupId && n.type === "sbv1-video-engine",
    );
    expect(newImg?.id).not.toBe("img1");
    expect(newVid?.id).not.toBe("vid1");

    const internalEdge = result.edges.find(
      (e) => e.source === newImg?.id && e.target === newVid?.id,
    );
    expect(internalEdge).toBeDefined();
    expect(internalEdge?.id).not.toBe("e1");

    expect(
      (newVid?.data as { runtime?: { status?: string; taskId?: string } })
        .runtime,
    ).toBeUndefined();
    expect(
      (newImg?.data as { runtime?: { ossUrl?: string } }).runtime?.ossUrl,
    ).toBe("https://example.com/a.png");
  });
});
