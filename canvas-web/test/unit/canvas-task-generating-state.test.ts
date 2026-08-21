import { describe, expect, it } from "vitest";

import {
  characterRowCountsAsInflight,
  libtvMediaLooksGenerating,
  pro2ThreeViewNodeCountsAsInflight,
  resolveCharacterRowGeneratingState,
  resolveLibtvMediaGeneratingState,
} from "@/lib/canvas/canvas-task-generating-state";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("resolveLibtvMediaGeneratingState", () => {
  it("uploading with blob and no gen task is not generating", () => {
    expect(
      resolveLibtvMediaGeneratingState({
        uploading: true,
        blobUrl: "blob:x",
        runtime: { status: "idle" },
      }).isGenerating,
    ).toBe(false);
  });

  it("pending runtime without media is generating", () => {
    expect(
      resolveLibtvMediaGeneratingState({
        runtime: { status: "pending", taskId: "t1" },
      }).isGenerating,
    ).toBe(true);
  });

  it("pending runtime over existing image is still generating", () => {
    expect(
      resolveLibtvMediaGeneratingState({
        ossUrl: "https://cdn.example/old.png",
        runtime: {
          status: "pending",
          taskId: "t2",
          ossUrl: "https://cdn.example/old.png",
        },
      }).isGenerating,
    ).toBe(true);
  });

  it("done runtime stops generating even if uploading flag stale", () => {
    expect(
      resolveLibtvMediaGeneratingState({
        uploading: true,
        runtime: { status: "done", ossUrl: "https://cdn/x.png" },
      }).isGenerating,
    ).toBe(false);
  });
});

describe("resolveCharacterRowGeneratingState", () => {
  it("defers to linked three-view node when column row pending", () => {
    const columnId = "col";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: {
          rows: [{ key: "a", runtime: { status: "pending" } }],
        },
      },
      {
        id: "tv",
        type: "story-pro2-three-view",
        position: { x: 0, y: 0 },
        data: {
          pro2ControllerNodeId: columnId,
          pro2RowKey: "a",
          runtime: { status: "done", ossUrl: "https://cdn/x.png" },
        },
      },
    ];
    expect(
      resolveCharacterRowGeneratingState({
        row: { key: "a", runtime: { status: "pending" } },
        columnId,
        nodes,
      }).isGenerating,
    ).toBe(false);
    expect(
      characterRowCountsAsInflight(
        { key: "a", runtime: { status: "pending" } },
        columnId,
        nodes,
      ),
    ).toBe(false);
  });

  it("counts orphan three-view inflight when column row not inflight", () => {
    const columnId = "col";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: { rows: [{ key: "a", runtime: { status: "done", ossUrl: "https://cdn/x.png" } }] },
      },
      {
        id: "tv",
        type: "story-pro2-three-view",
        position: { x: 0, y: 0 },
        data: {
          pro2ControllerNodeId: columnId,
          pro2RowKey: "a",
          uploading: true,
          runtime: { status: "pending" },
        },
      },
    ];
    expect(
      pro2ThreeViewNodeCountsAsInflight(nodes[1]!, nodes),
    ).toBe(true);
  });
});
