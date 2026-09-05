import { describe, expect, it } from "vitest";

import {
  applyCanvasDelta,
  assertCanvasDeltaBaseUpdatedAt,
} from "@/lib/canvas/canvas-delta-merge";
import { mergePersistedMediaIntoCanvasGraph } from "@/lib/canvas/canvas-persist-merge";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";

describe("applyCanvasDelta", () => {
  const base = {
    schemaVersion: 4,
    nodes: [
      {
        id: "n1",
        type: "sbv1-image",
        position: { x: 0, y: 0 },
        data: { label: "A", prompt: "hello", width: 512, height: 512 },
      },
      {
        id: "n2",
        type: "text",
        position: { x: 100, y: 0 },
        data: { text: "note" },
      },
    ],
    edges: [{ id: "e1", source: "n2", target: "n1" }],
    viewport: { x: 0, y: 0, zoom: 1 },
    meta: { edition: "sbv1" },
  };

  it("upsertNodes data 深合并，不丢其它字段", () => {
    const merged = applyCanvasDelta(base, {
      upsertNodes: [
        {
          id: "n1",
          data: { ossUrl: "https://cdn.example/a.png", uploading: false },
        },
      ],
    }) as typeof base;
    expect(merged.nodes.find((n) => n.id === "n1")?.data).toMatchObject({
      label: "A",
      prompt: "hello",
      width: 512,
      height: 512,
      ossUrl: "https://cdn.example/a.png",
      uploading: false,
    });
  });

  it("removeNodeIds 同时移除关联边", () => {
    const merged = applyCanvasDelta(base, {
      removeNodeIds: ["n1"],
    }) as typeof base;
    expect(merged.nodes.map((n) => n.id)).toEqual(["n2"]);
    expect(merged.edges).toEqual([]);
  });

  it("upsertEdges + removeEdgeIds", () => {
    const merged = applyCanvasDelta(base, {
      removeEdgeIds: ["e1"],
      upsertEdges: [{ id: "e2", source: "n1", target: "n2" }],
    }) as typeof base;
    expect(merged.edges).toEqual([
      { id: "e2", source: "n1", target: "n2" },
    ]);
  });

  it("viewport 与 meta 浅合并", () => {
    const merged = applyCanvasDelta(base, {
      viewport: { x: 10, y: 20, zoom: 0.5 },
      meta: { productionCanvas: true },
    }) as typeof base;
    expect(merged.viewport).toEqual({ x: 10, y: 20, zoom: 0.5 });
    expect(merged.meta).toEqual({ edition: "sbv1", productionCanvas: true });
  });

  it("空 delta 抛 INVALID_INPUT", () => {
    expect(() => applyCanvasDelta(base, {})).toThrow(CanvasProjectError);
  });
});

describe("applyCanvasDelta + mergePersistedMediaIntoCanvasGraph", () => {
  it("delta 后仍保留 DB 侧 done+ossUrl", () => {
    const existing = {
      nodes: [
        {
          id: "vid1",
          type: "sbv1-video-engine",
          data: {
            runtime: {
              status: "done",
              taskId: "task-a",
              ossUrl: "https://cdn.example/saved.mp4",
            },
          },
        },
      ],
    };
    const deltaMerged = applyCanvasDelta(existing, {
      upsertNodes: [
        {
          id: "vid1",
          data: { runtime: { status: "running", taskId: "task-a" } },
        },
      ],
    });
    const merged = mergePersistedMediaIntoCanvasGraph(
      deltaMerged,
      existing,
    ) as typeof existing;
    expect(merged.nodes[0]?.data?.runtime?.status).toBe("done");
    expect(merged.nodes[0]?.data?.runtime?.ossUrl).toBe(
      "https://cdn.example/saved.mp4",
    );
  });
});

describe("assertCanvasDeltaBaseUpdatedAt", () => {
  it("匹配时不抛错", () => {
    const d = new Date("2026-07-31T12:00:00.000Z");
    expect(() =>
      assertCanvasDeltaBaseUpdatedAt(d.toISOString(), d),
    ).not.toThrow();
  });

  it("不匹配时软放行（不抛 409，避免媒体写回与 autosave 冲突）", () => {
    const d = new Date("2026-07-31T12:00:00.000Z");
    expect(() =>
      assertCanvasDeltaBaseUpdatedAt("2026-07-31T11:00:00.000Z", d),
    ).not.toThrow();
  });
});
