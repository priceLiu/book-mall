import { describe, expect, it } from "vitest";
import {
  displayVideoRows,
  displayVideoRowsForFrameColumn,
} from "@/lib/canvas/story-column-display";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

describe("story-column-display · video rows", () => {
  it("does not recurse when sibling columns are incomplete (production wizard mount)", () => {
    const hubId = "hub-1";
    const frameId = "frame-col";
    const videoId = "video-col";

    const nodes: CanvasFlowNode[] = [
      {
        id: hubId,
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        data: {
          productionWizardMode: true,
          scriptStudioFrameRows: [
            { key: "f1", frameIndex: 1, prompt: "镜 1" },
            { key: "f2", frameIndex: 2, prompt: "镜 2" },
          ],
          scriptStudioVideoRows: [],
        },
      },
      {
        id: frameId,
        type: "story-pro2-frame",
        position: { x: 200, y: 0 },
        data: {
          hubNodeId: hubId,
          rows: [
            { key: "f1", frameIndex: 1, prompt: "镜 1" },
            { key: "f2", frameIndex: 2, prompt: "镜 2" },
          ],
        },
      },
      {
        id: videoId,
        type: "story-pro2-video",
        position: { x: 400, y: 0 },
        data: {
          hubNodeId: hubId,
          frameColumnId: frameId,
          rows: [],
        },
      },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "e1", source: frameId, target: videoId },
    ];

    expect(() =>
      displayVideoRows(nodes, videoId, [], edges),
    ).not.toThrow();

    const rows = displayVideoRowsForFrameColumn(
      nodes,
      videoId,
      [],
      frameId,
      edges,
    );
    expect(rows.length).toBe(2);
    expect(rows[0]?.frameIndex).toBe(1);
    expect(rows[1]?.frameIndex).toBe(2);
  });
});
