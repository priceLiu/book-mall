import { describe, expect, it } from "vitest";

import { canvasNodeRuntimeShowsVideo } from "@/lib/canvas/canvas-video-display-recover";

describe("canvasNodeRuntimeShowsVideo", () => {
  it("returns true when runtime done with media", () => {
    const canvas = {
      nodes: [
        {
          id: "n1",
          data: {
            runtime: {
              status: "done",
              taskId: "t1",
              ossUrl: "https://cdn.example/v.mp4",
            },
          },
        },
      ],
    };
    expect(canvasNodeRuntimeShowsVideo(canvas, "n1", "t1")).toBe(true);
  });

  it("returns false when still running", () => {
    const canvas = {
      nodes: [
        {
          id: "n1",
          data: { runtime: { status: "running", taskId: "t1" } },
        },
      ],
    };
    expect(canvasNodeRuntimeShowsVideo(canvas, "n1", "t1")).toBe(false);
  });
});
