import { describe, expect, it } from "vitest";

import {
  CANVAS_GENERATION_USER_CANCEL_FAIL_CODE,
  canvasIdleRuntimeAfterUserCancel,
  isUserCancelledCanvasTask,
} from "@/lib/canvas/canvas-generation-cancel-messages";
import { runtimePatchFromCanvasTask } from "@/lib/canvas/task-pick";

describe("canvas generation cancel", () => {
  it("detects user cancelled tasks", () => {
    expect(
      isUserCancelledCanvasTask({
        status: "CANCELLED",
        failCode: CANVAS_GENERATION_USER_CANCEL_FAIL_CODE,
      }),
    ).toBe(true);
    expect(
      isUserCancelledCanvasTask({ status: "CANCELLED", failCode: "OTHER" }),
    ).toBe(false);
  });

  it("returns idle runtime patch for user cancel", () => {
    expect(canvasIdleRuntimeAfterUserCancel("task-1")).toEqual({
      status: "idle",
      taskId: undefined,
      failCode: undefined,
      failMessage: undefined,
      dismissedFailTaskId: "task-1",
    });
  });

  it("maps cancelled user tasks to idle in runtimePatchFromCanvasTask", () => {
    expect(
      runtimePatchFromCanvasTask({
        id: "t1",
        nodeId: "n1",
        kind: "IMAGE",
        status: "CANCELLED",
        failCode: CANVAS_GENERATION_USER_CANCEL_FAIL_CODE,
        failMessage: "用户已中止生成",
        model: "",
        ossUrl: null,
        ephemeralUrl: null,
        textOutput: null,
        submittedAt: null,
        completedAt: null,
        kieTaskId: null,
        createdAt: "",
        updatedAt: "",
      }),
    ).toEqual({
      status: "idle",
      taskId: undefined,
      failCode: undefined,
      failMessage: undefined,
      dismissedFailTaskId: "t1",
    });
  });
});
