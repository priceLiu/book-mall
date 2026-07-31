import { describe, expect, it } from "vitest";

import {
  isCanvasPersistContentDirty,
  readCanvasPersistSnapshot,
  serializeCanvasPersistGraph,
} from "@/lib/canvas/canvas-persist-snapshot";
import type { CanvasGraph } from "@/lib/canvas/types";

const emptyGraph: CanvasGraph = {
  schemaVersion: 2,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("canvas-persist-snapshot", () => {
  it("content dirty ignores revision-only bump when strip graph unchanged", () => {
    const base = readCanvasPersistSnapshot({
      graphRevision: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      toGraph: () => emptyGraph,
    });
    const bumped = readCanvasPersistSnapshot({
      graphRevision: 99,
      viewport: { x: 0, y: 0, zoom: 1 },
      toGraph: () => emptyGraph,
    });
    expect(isCanvasPersistContentDirty(bumped, base)).toBe(false);
  });

  it("content dirty when viewport changes", () => {
    const base = readCanvasPersistSnapshot({
      graphRevision: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      toGraph: () => emptyGraph,
    });
    const moved = readCanvasPersistSnapshot({
      graphRevision: 2,
      viewport: { x: 10, y: 0, zoom: 1 },
      toGraph: () => emptyGraph,
    });
    expect(isCanvasPersistContentDirty(moved, base)).toBe(true);
  });

  it("serialize is stable for same graph", () => {
    const a = serializeCanvasPersistGraph(emptyGraph);
    const b = serializeCanvasPersistGraph({ ...emptyGraph });
    expect(a).toBe(b);
  });
});
