"use client";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import type { CanvasNodeRuntime } from "./types";
import { formatCanvasTaskError } from "./friendly-task-error";
import { pickTaskResultMediaUrl } from "./task-media-url";

function posterUrlFromTask(task: CanvasTaskRecord): string | undefined {
  const direct = task.posterUrl?.trim();
  if (direct) return direct;
  return undefined;
}

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

  if (task.status === "FAILED" || task.status === "CANCELLED") {
    return {
      uploading: false,
      uploadError: undefined,
      runtime: {
        status: "error",
        taskId: task.id,
        failCode: task.failCode ?? (task.status === "CANCELLED" ? "CANCELLED" : "FAILED"),
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

const VIDEO_INFLIGHT_STATUSES = new Set([
  "QUEUED",
  "DISPATCHING",
  "PENDING",
  "SUBMITTED",
]);

/** sbv1-video-engine 任务结果写回 runtime（与 image 一样清除 uploading） */
export function sbv1VideoPatchFromTask(
  task: CanvasTaskRecord,
): Record<string, unknown> | null {
  const mediaUrl =
    pickTaskResultMediaUrl(task) ??
    task.ossUrl ??
    task.ephemeralUrl ??
    undefined;

  if (task.status === "SUCCEEDED" && mediaUrl) {
    return {
      uploading: false,
      uploadError: undefined,
      runtime: {
        status: "done",
        taskId: task.id,
        ossUrl: mediaUrl,
        ephemeralUrl: task.ephemeralUrl ?? undefined,
        posterUrl: posterUrlFromTask(task),
        failCode: undefined,
        failMessage: undefined,
      } satisfies CanvasNodeRuntime,
    };
  }

  if (task.status === "FAILED" || task.status === "CANCELLED") {
    return {
      uploading: false,
      uploadError: undefined,
      runtime: {
        status: "error",
        taskId: task.id,
        failCode: task.failCode ?? (task.status === "CANCELLED" ? "CANCELLED" : "FAILED"),
        failMessage: formatCanvasTaskError(
          task.failCode,
          task.failMessage,
          task.model,
        ),
      } satisfies CanvasNodeRuntime,
    };
  }

  if (VIDEO_INFLIGHT_STATUSES.has(task.status)) {
    return {
      uploading: true,
      uploadError: undefined,
      runtime: {
        status:
          task.status === "QUEUED" || task.status === "PENDING"
            ? "pending"
            : "running",
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

/**
 * updateNodeData 前比对 · 避免 effect 重复写相同 patch 触发 RF 无限同步。
 *
 * 仅适用于「纯媒体/runtime patch」（仅含 runtime / uploading / uploadError）。
 * 若 patch 还带 prompt / durationSec / engine 等业务字段，一律放行（返回 false），
 * 否则会误吞普通字段更新（改时长、存提示词失效、刷新回退）。
 */
const SBV1_MEDIA_PATCH_KEYS = new Set(["runtime", "uploading", "uploadError"]);

export function isSameSbv1MediaDataPatch(
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): boolean {
  for (const key of Object.keys(patch)) {
    if (!SBV1_MEDIA_PATCH_KEYS.has(key)) return false;
  }
  const cur = current ?? {};
  if (
    patch.uploading !== undefined &&
    Boolean(patch.uploading) !== Boolean(cur.uploading)
  ) {
    return false;
  }
  if (
    "uploadError" in patch &&
    (patch.uploadError ?? undefined) !== (cur.uploadError ?? undefined)
  ) {
    return false;
  }
  const nextRt = patch.runtime as CanvasNodeRuntime | undefined;
  if (!nextRt) {
    return !("runtime" in patch);
  }
  const prev: Partial<CanvasNodeRuntime> =
    (cur.runtime as CanvasNodeRuntime | undefined) ?? {};
  return (
    (prev.status ?? "idle") === (nextRt.status ?? "idle") &&
    (prev.taskId ?? "") === (nextRt.taskId ?? "") &&
    (prev.failCode ?? "") === (nextRt.failCode ?? "") &&
    (prev.failMessage ?? "") === (nextRt.failMessage ?? "") &&
    (prev.ossUrl ?? "") === (nextRt.ossUrl ?? "") &&
    (prev.ephemeralUrl ?? "") === (nextRt.ephemeralUrl ?? "") &&
    (prev.posterUrl ?? "") === (nextRt.posterUrl ?? "")
  );
}
