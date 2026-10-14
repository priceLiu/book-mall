import { describe, expect, it } from "vitest";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  dedupeSucceededImageGenerationsByMedia,
  listSucceededImageGenerations,
  resolveActiveImageTaskId,
} from "@/lib/canvas/libtv-image-generation-stack";

function task(
  partial: Partial<CanvasTaskRecord> & Pick<CanvasTaskRecord, "id" | "status">,
): CanvasTaskRecord {
  return {
    projectId: "p1",
    nodeId: "n1",
    kind: "IMAGE",
    model: "test-model",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ossUrl: "https://cdn.example.com/node-image/a.png",
    ...partial,
  } as CanvasTaskRecord;
}

describe("libtv-image-generation-stack", () => {
  it("lists only succeeded tasks with displayable results", () => {
    const list = listSucceededImageGenerations([
      task({ id: "a", status: "SUCCEEDED", createdAt: "2026-01-01T00:00:00.000Z" }),
      task({ id: "b", status: "FAILED", createdAt: "2026-01-02T00:00:00.000Z" }),
      task({
        id: "c",
        status: "SUCCEEDED",
        ossUrl: null,
        ephemeralUrl: null,
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
      task({ id: "d", status: "SUCCEEDED", createdAt: "2026-01-04T00:00:00.000Z" }),
    ]);
    expect(list.map((t) => t.id)).toEqual(["a", "d"]);
  });

  it("resolveActiveImageTaskId prefers explicit activeImageTaskId", () => {
    const succeeded = [
      task({ id: "t1", status: "SUCCEEDED" }),
      task({ id: "t2", status: "SUCCEEDED", createdAt: "2026-01-02T00:00:00.000Z" }),
    ];
    expect(
      resolveActiveImageTaskId(
        { activeImageTaskId: "t1", runtime: { taskId: "t2" } },
        succeeded,
      ),
    ).toBe("t1");
  });

  it("dedupes succeeded tasks with the same preview URL", () => {
    const list = dedupeSucceededImageGenerationsByMedia([
      task({
        id: "t1",
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example.com/same.png",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      task({
        id: "t2",
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example.com/same.png",
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
      task({
        id: "t3",
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example.com/other.png",
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
    ]);
    expect(list.map((t) => t.id)).toEqual(["t2", "t3"]);
  });

  it("falls back to latest succeeded task", () => {
    const succeeded = [
      task({ id: "t1", status: "SUCCEEDED" }),
      task({ id: "t2", status: "SUCCEEDED", createdAt: "2026-01-02T00:00:00.000Z" }),
    ];
    expect(resolveActiveImageTaskId({}, succeeded)).toBe("t2");
  });
});
