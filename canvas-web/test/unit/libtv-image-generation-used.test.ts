import { describe, expect, it } from "vitest";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  appendUsedImageTaskIds,
  collectLibtvUsedImageTaskIds,
  isLibtvImageMediaConsumedInGraph,
} from "@/lib/canvas/libtv-image-generation-used";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

function task(
  partial: Partial<CanvasTaskRecord> & Pick<CanvasTaskRecord, "id" | "status" | "nodeId">,
): CanvasTaskRecord {
  return {
    projectId: "p1",
    kind: "IMAGE",
    model: "m",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ossUrl: "https://cdn.example.com/a.png",
    ...partial,
  } as CanvasTaskRecord;
}

describe("libtv-image-generation-used", () => {
  it("appendUsedImageTaskIds dedupes", () => {
    expect(appendUsedImageTaskIds(["t1"], "t1")).toEqual(["t1"]);
    expect(appendUsedImageTaskIds(["t1"], "t2").sort()).toEqual(["t1", "t2"]);
  });

  it("collectLibtvUsedImageTaskIds merges persisted and graph", () => {
    const imageId = "img1";
    const videoId = "vid1";
    const url = "https://cdn.example.com/a.png";
    const nodes = [
      {
        id: imageId,
        type: "story-pro2-image",
        data: {
          ossUrl: url,
          runtime: { status: "done", taskId: "t1" },
          usedImageTaskIds: [],
        },
        position: { x: 0, y: 0 },
      },
      {
        id: videoId,
        type: "sbv1-video-engine",
        data: { dockInput: "" },
        position: { x: 200, y: 0 },
      },
    ] as CanvasFlowNode[];
    const edges = [
      { id: "e1", source: imageId, target: videoId, sourceHandle: "image" },
    ] as CanvasFlowEdge[];
    const history = [
      task({
        id: "t1",
        nodeId: imageId,
        status: "SUCCEEDED",
        ossUrl: url,
      }),
      task({
        id: "tv1",
        nodeId: videoId,
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example.com/v.mp4",
      }),
    ];

    const used = collectLibtvUsedImageTaskIds({
      nodeId: imageId,
      nodeData: nodes[0]!.data as { usedImageTaskIds?: string[] },
      nodes,
      edges,
      history,
    });
    expect(used.has("t1")).toBe(true);
  });

  it("isLibtvImageMediaConsumedInGraph false without downstream success", () => {
    const imageId = "img1";
    const url = "https://cdn.example.com/a.png";
    const nodes = [
      {
        id: imageId,
        type: "sbv1-image",
        data: { ossUrl: url, runtime: { status: "done", taskId: "t1" } },
        position: { x: 0, y: 0 },
      },
    ] as CanvasFlowNode[];
    expect(
      isLibtvImageMediaConsumedInGraph({
        sourceNodeId: imageId,
        mediaUrl: url,
        nodes,
        edges: [],
        history: [
          task({ id: "t1", nodeId: imageId, status: "SUCCEEDED", ossUrl: url }),
        ],
      }),
    ).toBe(false);
  });
});
