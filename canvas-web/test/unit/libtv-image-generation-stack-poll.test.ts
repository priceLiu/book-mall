import { describe, expect, it } from "vitest";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { shouldSkipLibtvImageTaskPollApply } from "@/lib/canvas/libtv-image-generation-stack";

function task(id: string): CanvasTaskRecord {
  return {
    id,
    nodeId: "n1",
    status: "SUCCEEDED",
    model: "m",
    createdAt: "",
    updatedAt: "",
    ossUrl: "https://cdn.example.com/a.png",
  } as CanvasTaskRecord;
}

describe("shouldSkipLibtvImageTaskPollApply", () => {
  it("skips newer succeeded when user pinned older generation", () => {
    expect(
      shouldSkipLibtvImageTaskPollApply(
        {
          activeImageTaskId: "t-old",
          runtime: { status: "done", taskId: "t-old" },
        },
        task("t-new"),
      ),
    ).toBe(true);
  });

  it("allows apply for pinned task", () => {
    expect(
      shouldSkipLibtvImageTaskPollApply(
        {
          activeImageTaskId: "t-old",
          runtime: { status: "done", taskId: "t-old" },
        },
        task("t-old"),
      ),
    ).toBe(false);
  });
});
