import { describe, expect, it } from "vitest";

import {
  collectJianyingFramesForExportNode,
  collectJianyingFramesFromLibtvVideos,
} from "@/lib/canvas/jianying-from-workspace";
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
});
