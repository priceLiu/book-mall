"use client";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import type { CanvasNodeRuntime } from "./types";
import { formatCanvasTaskError } from "./friendly-task-error";
import { pickTaskResultMediaUrl } from "./task-media-url";

/** sbv1-image 任务结果写回节点 ossUrl + runtime */
export function sbv1ImagePatchFromTask(
  prev: Sbv1ImageNodeData,
  task: CanvasTaskRecord,
): Record<string, unknown> | null {
  const mediaUrl = pickTaskResultMediaUrl(task) ?? task.ossUrl ?? undefined;

  if (task.status === "SUCCEEDED" && mediaUrl) {
    const hadImage = Boolean(prev.ossUrl?.trim() || prev.blobUrl?.trim());
    return {
      ossUrl: mediaUrl,
      blobUrl: undefined,
      uploading: false,
      uploadError: undefined,
      imageMode: hadImage ? "img2img" : "txt2img",
      runtime: {
        status: "done",
        taskId: task.id,
        ossUrl: mediaUrl,
        ephemeralUrl: task.ephemeralUrl ?? undefined,
        failCode: undefined,
        failMessage: undefined,
      } satisfies CanvasNodeRuntime,
    };
  }

  if (task.status === "FAILED") {
    return {
      uploading: false,
      uploadError: undefined,
      runtime: {
        status: "error",
        taskId: task.id,
        failCode: task.failCode ?? "FAILED",
        failMessage: formatCanvasTaskError(
          task.failCode,
          task.failMessage,
          task.model,
        ),
      } satisfies CanvasNodeRuntime,
    };
  }

  if (task.status === "SUBMITTED" || task.status === "PENDING") {
    return {
      uploading: true,
      uploadError: undefined,
      runtime: {
        status: task.status === "PENDING" ? "pending" : "running",
        taskId: task.id,
        failCode: undefined,
        failMessage: undefined,
      } satisfies CanvasNodeRuntime,
    };
  }

  return null;
}

/** 运行失败 / 中止 · 清除 uploading 并写入 runtime.error（节点 UI 可读） */
export function sbv1ImageFailurePatch(
  failCode: string,
  failMessage: string,
): Record<string, unknown> {
  return {
    uploading: false,
    uploadError: undefined,
    runtime: {
      status: "error",
      failCode,
      failMessage: formatCanvasTaskError(failCode, failMessage),
    } satisfies CanvasNodeRuntime,
  };
}
