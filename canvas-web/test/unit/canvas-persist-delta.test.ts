import { describe, expect, it } from "vitest";

import {
  buildCanvasPersistDelta,
  buildCanvasUploadPersistDelta,
} from "@/lib/canvas/canvas-persist-delta";
import type { CanvasGraph } from "@/lib/canvas/types";

const baseGraph = (): CanvasGraph => ({
  schemaVersion: 4,
  nodes: [
    {
      id: "n1",
      type: "sbv1-image",
      position: { x: 0, y: 0 },
      data: { prompt: "a", width: 512, height: 512 },
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
});

describe("buildCanvasPersistDelta", () => {
  it("returns null when graphs are identical", () => {
    const g = baseGraph();
    expect(buildCanvasPersistDelta(g, { ...g, nodes: [...g.nodes] })).toBeNull();
  });

  it("upserts changed node only", () => {
    const last = baseGraph();
    const current = baseGraph();
    current.nodes = current.nodes.map((n) =>
      n.id === "n1"
        ? { ...n, data: { ...n.data, ossUrl: "https://cdn.example/a.png" } }
        : n,
    );
    const delta = buildCanvasPersistDelta(last, current);
    expect(delta?.upsertNodes?.map((n) => n.id)).toEqual(["n1"]);
    expect(delta?.removeNodeIds).toBeUndefined();
  });

  it("detects removed nodes and edges", () => {
    const last = baseGraph();
    const current = baseGraph();
    current.nodes = current.nodes.filter((n) => n.id !== "n2");
    current.edges = [];
    const delta = buildCanvasPersistDelta(last, current)!;
    expect(delta.removeNodeIds).toEqual(["n2"]);
    expect(delta.removeEdgeIds).toEqual(["e1"]);
  });

  it("viewport-only delta", () => {
    const last = baseGraph();
    const current = { ...baseGraph(), viewport: { x: 5, y: 0, zoom: 1 } };
    const delta = buildCanvasPersistDelta(last, current)!;
    expect(delta.viewport).toEqual({ x: 5, y: 0, zoom: 1 });
    expect(delta.upsertNodes).toBeUndefined();
  });
});

describe("buildCanvasUploadPersistDelta", () => {
  it("includes full strip node with ossUrl", () => {
    const g = baseGraph();
    g.nodes = g.nodes.map((n) =>
      n.id === "n1"
        ? {
            ...n,
            data: {
              ...n.data,
              ossUrl: "https://cdn.example/up.png",
              uploading: false,
            },
          }
        : n,
    );
    const delta = buildCanvasUploadPersistDelta(["n1"], g)!;
    expect(delta.upsertNodes).toHaveLength(1);
    expect(delta.upsertNodes?.[0]?.data).toMatchObject({
      ossUrl: "https://cdn.example/up.png",
    });
  });
});
