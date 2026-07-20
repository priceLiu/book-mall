import { describe, expect, it, vi } from "vitest";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { restoreServerInflightNodeRuntimes } from "@/lib/canvas/restore-server-inflight-node-runtimes";
import { pickPreferredCanvasTask } from "@/lib/canvas/task-pick";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function task(
  partial: Partial<CanvasTaskRecord> & Pick<CanvasTaskRecord, "id" | "status">,
): CanvasTaskRecord {
  return {
    nodeId: "node-1",
    model: "happyhorse-1.0-r2v",
    createdAt: "2026-07-16T10:00:00.000Z",
    updatedAt: "2026-07-16T10:00:00.000Z",
    ...partial,
  } as CanvasTaskRecord;
}

describe("pickPreferredCanvasTask", () => {
  it("prefers succeeded video over newer failed retry", () => {
    const pick = pickPreferredCanvasTask([
      task({
        id: "ok",
        status: "SUCCEEDED",
        updatedAt: "2026-07-16T10:05:00.000Z",
        ossUrl: "https://cdn.example/ok.mp4",
      }),
      task({
        id: "fail",
        status: "FAILED",
        updatedAt: "2026-07-16T10:10:00.000Z",
        failCode: "timeout_poll_error",
        failMessage: "gateway recordInfo timeout",
      }),
    ]);
    expect(pick?.id).toBe("ok");
  });

  it("still returns non-stale inflight when present", () => {
    const pick = pickPreferredCanvasTask([
      task({
        id: "ok",
        status: "SUCCEEDED",
        updatedAt: "2026-07-16T10:05:00.000Z",
        completedAt: "2026-07-16T10:05:00.000Z",
        ossUrl: "https://cdn.example/ok.mp4",
      }),
      task({
        id: "running",
        status: "SUBMITTED",
        updatedAt: "2026-07-16T10:11:00.000Z",
        submittedAt: "2026-07-16T10:11:00.000Z",
      }),
    ]);
    expect(pick?.id).toBe("running");
  });
});

describe("restoreServerInflightNodeRuntimes", () => {
  it("sbv1-video-engine idle 时从服务端 SUBMITTED 恢复 running", () => {
    const node: CanvasFlowNode = {
      id: "video-1",
      type: "sbv1-video-engine",
      position: { x: 0, y: 0 },
      data: { runtime: { status: "idle" } },
    };
    const updateNodeData = vi.fn();
    restoreServerInflightNodeRuntimes(
      [node],
      [
        task({
          id: "task-1",
          nodeId: "video-1",
          status: "SUBMITTED",
          submittedAt: "2026-07-16T10:11:00.000Z",
        }),
      ],
      updateNodeData,
      vi.fn(),
    );
    expect(updateNodeData).toHaveBeenCalledWith(
      "video-1",
      expect.objectContaining({
        runtime: expect.objectContaining({
          status: "running",
          taskId: "task-1",
        }),
      }),
    );
  });
});
