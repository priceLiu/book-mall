/** 用户主动中止生成 / 剪辑 · 确认文案（须 useDialogs confirm） */

import type { CanvasNodeRuntime } from "./types";

export const CANVAS_GENERATION_USER_CANCEL_FAIL_CODE = "USER_CANCELLED";

export const GENERATION_CANCEL_CONFIRM_TITLE = "中止生成？";

export const GENERATION_CANCEL_CONFIRM_MESSAGE =
  "中止后画布将停止等待结果。若服务端已完成生成或已提交厂商任务，仍可能计入积分或产生费用，无法自动撤回。";

export const MEDIA_RENDER_CANCEL_CONFIRM_TITLE = "中止自动剪辑？";

export const MEDIA_RENDER_CANCEL_CONFIRM_MESSAGE =
  "中止后界面将停止等待。若服务端已完成剪辑或已调用语音识别，仍可能产生费用，无法自动撤回。";

export function isUserCancelledCanvasTask(task: {
  status?: string | null;
  failCode?: string | null;
}): boolean {
  return (
    task.status === "CANCELLED" &&
    task.failCode?.trim() === CANVAS_GENERATION_USER_CANCEL_FAIL_CODE
  );
}

/** 用户中止后本地 runtime · 回到 idle，并标记 task 勿再写回 error */
export function canvasIdleRuntimeAfterUserCancel(
  taskId?: string,
): CanvasNodeRuntime {
  const id = taskId?.trim();
  return {
    status: "idle",
    taskId: undefined,
    failCode: undefined,
    failMessage: undefined,
    dismissedFailTaskId: id || undefined,
  };
}
