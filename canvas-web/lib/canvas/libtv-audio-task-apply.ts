"use client";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { CanvasNodeRuntime } from "./types";
import {
  canvasIdleRuntimeAfterUserCancel,
  isUserCancelledCanvasTask,
} from "./canvas-generation-cancel-messages";
import { formatCanvasTaskError } from "./friendly-task-error";
import { resolveLibtvAudioHttpsExportUrl } from "./libtv-audio-export-url";
import { pickTaskResultMediaUrl } from "./task-media-url";
import { isSameSbv1MediaDataPatch } from "./sbv1-image-task-apply";

export type LibtvAudioNodeData = {
  label?: string;
  ossUrl?: string;
  blobUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  dockInput?: string;
  engine?: {
    providerId?: string;
    modelKey?: string;
    params?: Record<string, unknown>;
  };
  runtime?: CanvasNodeRuntime;
};

/** story-pro2-audio 任务结果写回 ossUrl + runtime */
export function libtvAudioPatchFromTask(
  prev: LibtvAudioNodeData,
  task: CanvasTaskRecord,
): Record<string, unknown> | null {
  const mediaUrl = pickTaskResultMediaUrl(task) ?? task.ossUrl ?? undefined;

  if (task.status === "SUCCEEDED" && mediaUrl) {
    const httpsExportUrl =
      resolveLibtvAudioHttpsExportUrl({
        ossUrl: task.ossUrl ?? undefined,
        runtime: {
          ossUrl: task.ossUrl ?? undefined,
          ephemeralUrl: task.ephemeralUrl ?? undefined,
        },
      }) ?? undefined;
    const localPreviewUrl =
      httpsExportUrl ??
      task.ephemeralUrl?.trim() ??
      mediaUrl;
    const isLocalOnly =
      !httpsExportUrl &&
      (localPreviewUrl.startsWith("data:") ||
        localPreviewUrl.startsWith("blob:"));
    return {
      ossUrl: httpsExportUrl,
      blobUrl: isLocalOnly ? localPreviewUrl : undefined,
      uploading: !httpsExportUrl,
      uploadError: undefined,
      runtime: {
        status: "done",
        taskId: task.id,
        ossUrl: httpsExportUrl,
        ephemeralUrl: task.ephemeralUrl ?? localPreviewUrl,
        failCode: undefined,
        failMessage: undefined,
      } satisfies CanvasNodeRuntime,
    };
  }

  if (task.status === "FAILED" || task.status === "CANCELLED") {
    if (isUserCancelledCanvasTask(task)) {
      return {
        uploading: false,
        uploadError: undefined,
        runtime: canvasIdleRuntimeAfterUserCancel(task.id),
      };
    }
    return {
      uploading: false,
      uploadError: undefined,
      runtime: {
        status: "error",
        taskId: task.id,
        failCode:
          task.failCode ??
          (task.status === "CANCELLED" ? "CANCELLED" : "FAILED"),
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

export { isSameSbv1MediaDataPatch as isSameLibtvAudioDataPatch };
