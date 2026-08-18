import { describe, expect, it } from "vitest";

import { buildGridSplitPrepareFromNodeData } from "@/lib/generation/traffic-control/dispatch-canvas-image";
import {
  canvasTrafficPayloadWhere,
  isCanvasImageTrafficKind,
  isCanvasTrafficKind,
  isCanvasVideoTrafficKind,
  readGridSplitPrepare,
  readPipelineStage,
} from "@/lib/canvas/canvas-traffic-kind";
import { buildCanvasPendingLogRow } from "@/lib/canvas/canvas-pending-log-row";
import type { CanvasQueuedTaskRow } from "@/lib/canvas/canvas-queue-without-log";

describe("canvas-traffic-kind", () => {
  it("recognizes video and image engine payloads", () => {
    expect(isCanvasVideoTrafficKind({ kind: "video-engine" })).toBe(true);
    expect(isCanvasImageTrafficKind({ kind: "image-engine" })).toBe(true);
    expect(isCanvasImageTrafficKind({ kind: "three-view-engine" })).toBe(true);
    expect(isCanvasTrafficKind({ kind: "image-engine" })).toBe(true);
    expect(isCanvasTrafficKind({ kind: "ai-engine" })).toBe(true);
    expect(isCanvasTrafficKind({ kind: "unknown-kind" })).toBe(false);
  });

  it("canvasTrafficPayloadWhere includes image kinds", () => {
    const where = canvasTrafficPayloadWhere();
    expect(where.OR).toHaveLength(4);
  });

  it("readGridSplitPrepare parses crop spec", () => {
    const p = readGridSplitPrepare({
      gridSplitPrepare: {
        sourceUrl: "https://cdn.example.com/grid.jpg",
        col: 1,
        row: 2,
        cols: 3,
        rows: 3,
      },
    });
    expect(p?.col).toBe(1);
    expect(p?.row).toBe(2);
  });

  it("buildGridSplitPrepareFromNodeData skips precropped nodes", () => {
    expect(
      buildGridSplitPrepareFromNodeData({
        pro2HdFromGridSplit: true,
        gridSplitFrameCrop: true,
        gridSplitSourceUrl: "https://cdn.example.com/a.jpg",
        gridSplitCrop: { col: 0, row: 0, cols: 2, rows: 2 },
      }),
    ).toBeUndefined();
    expect(
      buildGridSplitPrepareFromNodeData({
        pro2HdFromGridSplit: true,
        gridSplitSourceUrl: "https://cdn.example.com/a.jpg",
        gridSplitCrop: { col: 0, row: 0, cols: 2, rows: 2 },
      })?.sourceUrl,
    ).toBe("https://cdn.example.com/a.jpg");
  });

  it("pending log row uses PREPARING for image pipeline stage", () => {
    const row: CanvasQueuedTaskRow = {
      id: "t1",
      status: "DISPATCHING",
      projectId: "p1",
      projectName: "demo",
      nodeId: "n1",
      model: "nano-banana-pro",
      queuedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      dispatchAfter: null,
      waitMinutes: 0,
      trafficStartedAt: new Date().toISOString(),
      payloadKind: "image-engine",
      actorUserId: "u1",
      inputPayload: {
        kind: "image-engine",
        pipelineStage: "PREPARING",
        prompt: "test",
      },
    };
    const pending = buildCanvasPendingLogRow(row);
    expect(pending.status).toBe("PREPARING");
    expect(pending.requestKind).toBe("IMAGE");
    expect(readPipelineStage(row.inputPayload!)).toBe("PREPARING");
  });
});
