import type { CanvasNodeRuntime } from "./types";

/** 画布节点 · 本地 ffmpeg 处理（不经 CanvasGenerationTask） */
export const LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT =
  "video-track-split" as const;
export const LIBTV_LOCAL_MEDIA_JOB_VIDEO_FRAME_EXTRACT =
  "video-frame-extract" as const;
export const LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRIM = "video-trim" as const;

export type LibtvLocalMediaJobKind =
  | typeof LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT
  | typeof LIBTV_LOCAL_MEDIA_JOB_VIDEO_FRAME_EXTRACT
  | typeof LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRIM;

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
  const k = runtime?.localJobKind;
  if (
    k !== LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT &&
    k !== LIBTV_LOCAL_MEDIA_JOB_VIDEO_FRAME_EXTRACT &&
    k !== LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRIM
  ) {
    return false;
  }
  return (
    runtime?.status === "queued" ||
    runtime?.status === "pending" ||
    runtime?.status === "running"
  );
}
