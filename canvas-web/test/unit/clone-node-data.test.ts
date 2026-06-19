import { describe, expect, it } from "vitest";

import {
  canvasNodesShareDataRef,
  cloneCanvasNodeData,
  duplicateCanvasNodeData,
  isolateSharedCanvasNodeData,
} from "@/lib/canvas/clone-node-data";

describe("clone-node-data", () => {
  it("deep-clones nested engine params", () => {
    const src = {
      prompt: "hello",
      engine: { providerId: "p", modelKey: "m", params: { duration: 15 } },
    };
    const copy = cloneCanvasNodeData(src);
    expect(copy).not.toBe(src);
    expect(copy.engine).not.toBe(src.engine);
    expect(copy.prompt).toBe("hello");
    (copy.engine as { params: { duration: number } }).params.duration = 5;
    expect(src.engine.params.duration).toBe(15);
  });

  it("duplicate with preserveContent detaches taskId", () => {
    const src = {
      prompt: "a",
      runtime: { status: "done", taskId: "task_1", ossUrl: "https://x/v.mp4" },
    };
    const dup = duplicateCanvasNodeData(src, true);
    expect(dup).not.toBe(src);
    expect(dup.prompt).toBe("a");
    expect((dup.runtime as { taskId?: string }).taskId).toBeUndefined();
    expect((dup.runtime as { ossUrl?: string }).ossUrl).toBe("https://x/v.mp4");
    dup.prompt = "b";
    expect(src.prompt).toBe("a");
  });

  it("detects shared data references between nodes", () => {
    const shared = { prompt: "x" };
    const nodes = [{ id: "a", data: shared }, { id: "b", data: shared }];
    expect(canvasNodesShareDataRef(nodes, shared)).toBe(true);
    expect(canvasNodesShareDataRef(nodes, { prompt: "y" })).toBe(false);
  });

  it("isolates nodes that share the same data reference", () => {
    const shared = { prompt: "shared", engine: { modelKey: "m" } };
    const nodes = [
      { id: "a", type: "sbv1-video-engine", data: shared, position: { x: 0, y: 0 } },
      { id: "b", type: "sbv1-video-engine", data: shared, position: { x: 0, y: 0 } },
    ] as import("@/lib/canvas/types").CanvasFlowNode[];
    const next = isolateSharedCanvasNodeData(nodes);
    expect(next[0]!.data).not.toBe(next[1]!.data);
    expect((next[0]!.data as { prompt: string }).prompt).toBe("shared");
    (next[0]!.data as { prompt: string }).prompt = "a";
    expect((next[1]!.data as { prompt: string }).prompt).toBe("shared");
  });
});
