import { describe, expect, it } from "vitest";
import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  pickPro2VideoBoardRowApplyTask,
  pickPro2VideoBoardRowSucceededTask,
} from "@/lib/canvas/pro2-video-board-cell-task";

function rowTask(
  partial: Partial<CanvasTaskRecord> & Pick<CanvasTaskRecord, "id" | "status">,
): CanvasTaskRecord {
  return {
    nodeId: "video-col",
    model: "test-video",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    storyScope: { rowKey: "row-1", mediaKind: "video" },
    ...partial,
  } as CanvasTaskRecord;
}

describe("pro2 video board row task pick", () => {
  it("prefers succeeded task with media over newer failed retry", () => {
    const tasks = [
      rowTask({
        id: "ok",
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example/v1.mp4",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      rowTask({
        id: "fail",
        status: "FAILED",
        failCode: "FAILED",
        failMessage: "vendor error",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ];

    expect(pickPro2VideoBoardRowSucceededTask(tasks, "video-col", "row-1")?.id).toBe(
      "ok",
    );
    expect(pickPro2VideoBoardRowApplyTask(tasks, "video-col", "row-1")?.id).toBe(
      "ok",
    );
  });

  it("uses newest failed when no succeeded media exists", () => {
    const tasks = [
      rowTask({
        id: "fail-old",
        status: "FAILED",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      rowTask({
        id: "fail-new",
        status: "FAILED",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ];

    expect(pickPro2VideoBoardRowApplyTask(tasks, "video-col", "row-1")?.id).toBe(
      "fail-new",
    );
  });

  it("prefers inflight over terminal tasks", () => {
    const tasks = [
      rowTask({
        id: "ok",
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example/v1.mp4",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      rowTask({
        id: "running",
        status: "PENDING",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ];

    expect(pickPro2VideoBoardRowApplyTask(tasks, "video-col", "row-1")?.id).toBe(
      "running",
    );
  });

  it("ignores stale submitted when newer succeeded media exists", () => {
    const tasks = [
      rowTask({
        id: "ok",
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example/v1.mp4",
        updatedAt: "2026-01-03T00:00:00.000Z",
      }),
      rowTask({
        id: "stale",
        status: "SUBMITTED",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ];

    expect(pickPro2VideoBoardRowApplyTask(tasks, "video-col", "row-1")?.id).toBe(
      "ok",
    );
  });

  it("prefers orphan submitted over older succeeded when local retry is inflight", () => {
    const tasks = [
      rowTask({
        id: "ok",
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example/v1.mp4",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      rowTask({
        id: "retry",
        status: "SUBMITTED",
        updatedAt: "2026-01-03T00:00:00.000Z",
      }),
    ];

    expect(
      pickPro2VideoBoardRowApplyTask(tasks, "video-col", "row-1", {
        status: "running",
        taskId: "retry",
      })?.id,
    ).toBe("retry");
  });
});
