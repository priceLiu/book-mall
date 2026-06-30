import { describe, expect, it } from "vitest";

import {
  collectJianyingFramesForExportNode,
  collectJianyingFramesFromLibtvVideos,
  collectJianyingLibtvConnectionSnapshot,
} from "@/lib/canvas/jianying-from-workspace";
import {
  buildBatchConnectEdges,
  expandBatchSnapConnection,
} from "@/lib/canvas/pro2-batch-connect";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

function videoNode(
  id: string,
  x: number,
  ossUrl?: string,
  prompt?: string,
): CanvasFlowNode {
  return {
    id,
    type: "sbv1-video-engine",
    position: { x, y: 0 },
    data: {
      prompt,
      runtime: ossUrl ? { status: "done", ossUrl } : { status: "idle" },
    },
  };
}

describe("collectJianyingFramesFromLibtvVideos", () => {
  it("collects connected videos sorted by X and assigns frame indices", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-b", 200, "https://oss/b.mp4", "镜二"),
      videoNode("v-a", 100, "https://oss/a.mp4", "镜一"),
      { id: exportId, type: "jianying-export-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: "v-b",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
      {
        id: "e2",
        source: "v-a",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
    ];

    const frames = collectJianyingFramesFromLibtvVideos(exportId, nodes, edges);
    expect(frames).toHaveLength(2);
    expect(frames[0]?.frameIndex).toBe(1);
    expect(frames[0]?.videoUrl).toBe("https://oss/a.mp4");
    expect(frames[0]?.dialogue).toBe("镜一");
    expect(frames[1]?.frameIndex).toBe(2);
    expect(frames[1]?.videoUrl).toBe("https://oss/b.mp4");
  });

  it("prefers LibTV edges over workspace columns", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v1", 50, "https://oss/libtv.mp4"),
      { id: exportId, type: "jianying-export-pro2", position: { x: 300, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: "v1",
        target: exportId,
        targetHandle: "in_video",
      },
    ];

    const frames = collectJianyingFramesForExportNode(exportId, nodes, edges, {
      frameColumnId: "missing",
      videoColumnId: "missing",
    });
    expect(frames).toHaveLength(1);
    expect(frames[0]?.videoUrl).toBe("https://oss/libtv.mp4");
  });

  it("reports connected vs rendered counts", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-done", 100, "https://oss/a.mp4"),
      videoNode("v-pending", 200),
      { id: exportId, type: "jianying-export-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: "v-done",
        target: exportId,
        targetHandle: "in_video",
      },
      {
        id: "e2",
        source: "v-pending",
        target: exportId,
        targetHandle: "in_video",
      },
    ];

    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges);
    expect(snap.connectedCount).toBe(2);
    expect(snap.renderedCount).toBe(1);
    expect(snap.frames).toHaveLength(1);
  });
});

describe("pro2-batch-connect", () => {
  it("builds batch edges to export node", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      { id: "v1", type: "sbv1-video-engine", position: { x: 0, y: 0 }, data: {} },
      { id: "v2", type: "sbv1-video-engine", position: { x: 200, y: 0 }, data: {} },
      { id: exportId, type: "jianying-export-pro2", position: { x: 500, y: 0 }, data: {} },
    ];
    const edges = buildBatchConnectEdges(
      nodes.filter((n) => n.type === "sbv1-video-engine"),
      exportId,
      nodes,
      [],
    );
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.targetHandle === "in_video")).toBe(true);
  });

  it("expandBatchSnapConnection fans out multi-select drag", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      { id: "v1", type: "sbv1-video-engine", position: { x: 0, y: 0 }, data: {} },
      { id: "v2", type: "sbv1-video-engine", position: { x: 200, y: 0 }, data: {} },
      { id: exportId, type: "jianying-export-pro2", position: { x: 500, y: 0 }, data: {} },
    ];
    const batch = expandBatchSnapConnection(
      {
        source: "v1",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
      ["v1", "v2"],
      nodes,
      [] as CanvasFlowEdge[],
    );
    expect(batch).toHaveLength(2);
  });
});
