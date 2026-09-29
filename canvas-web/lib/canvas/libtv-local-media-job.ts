import type { CanvasNodeRuntime } from "./types";

/** 画布节点 · 本地 ffmpeg 处理（不经 CanvasGenerationTask） */
export const LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT =
  "video-track-split" as const;

export type LibtvLocalMediaJobKind =
  typeof LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT;

export function libtvLocalMediaJobRunningRuntime(
  kind: LibtvLocalMediaJobKind = LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT,
): CanvasNodeRuntime {
  return {
    status: "running",
    localJobKind: kind,
  };
}

export function isLibtvLocalMediaJobRuntime(
  runtime?: CanvasNodeRuntime | null,
): boolean {
  return (
    runtime?.localJobKind === LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT &&
    (runtime.status === "queued" ||
      runtime.status === "pending" ||
      runtime.status === "running")
  );
}
