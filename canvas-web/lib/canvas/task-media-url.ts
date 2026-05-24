import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { CanvasNodeRuntime } from "./types";

const VIDEO_EXT = /\.mp4(\?|#|$)/i;
const MODEL_EXT = /\.(glb|gltf|obj|fbx|stl|usdz|mp4)(\?|#|$)/i;
const RASTER_EXT = /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i;

export function isLikelyVideoUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return VIDEO_EXT.test(u) || u.includes("/node-video/");
}

export function isLikelyModelMediaUrl(url: string): boolean {
  return MODEL_EXT.test(url.trim());
}

export function isLikelyRasterImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (isLikelyModelMediaUrl(u)) return false;
  if (RASTER_EXT.test(u)) return true;
  return true;
}

/** 从任务记录挑选可用于 `<img>` 的预览 URL（优先 OSS 预览图，避免把 GLB 当图片）。 */
export function pickTaskImagePreviewUrl(
  task: Pick<CanvasTaskRecord, "ossUrl" | "ephemeralUrl" | "model">,
): string | undefined {
  const oss = task.ossUrl?.trim();
  const ephem = task.ephemeralUrl?.trim();

  if (oss && isLikelyRasterImageUrl(oss)) return oss;
  if (ephem && isLikelyRasterImageUrl(ephem)) return ephem;
  if (oss && !isLikelyModelMediaUrl(oss)) return oss;
  return undefined;
}

/** 混元等：仅有 3D 模型、无栅格预览图 */
export function pickTaskModelDownloadUrl(
  task: Pick<CanvasTaskRecord, "ossUrl" | "ephemeralUrl" | "model">,
): string | undefined {
  const isHunyuan =
    task.model === "hunyuan-3d-pro" || task.model === "hunyuan-3d-express";
  if (!isHunyuan) return undefined;
  const ephem = task.ephemeralUrl?.trim();
  const oss = task.ossUrl?.trim();
  if (ephem && isLikelyModelMediaUrl(ephem)) return ephem;
  if (oss && isLikelyModelMediaUrl(oss)) return oss;
  if (ephem && oss && ephem !== oss) return ephem;
  return undefined;
}

/** 图生视频等：mp4 / node-video OSS */
export function pickTaskVideoUrl(
  task: Pick<CanvasTaskRecord, "ossUrl" | "ephemeralUrl">,
): string | undefined {
  for (const u of [task.ossUrl?.trim(), task.ephemeralUrl?.trim()]) {
    if (u && isLikelyVideoUrl(u)) return u;
  }
  return undefined;
}

/** 任务结果 URL：视频 / 栅格图 / 3D 模型 / 原始 OSS */
export function pickTaskResultMediaUrl(
  task: Pick<
    CanvasTaskRecord,
    "ossUrl" | "ephemeralUrl" | "model" | "textOutput"
  >,
): string | undefined {
  return (
    pickTaskVideoUrl(task) ??
    pickTaskImagePreviewUrl(task) ??
    pickTaskModelDownloadUrl(task) ??
    task.ossUrl?.trim() ??
    task.ephemeralUrl?.trim() ??
    undefined
  );
}

export function taskHasPreviewableImage(
  task: Pick<
    CanvasTaskRecord,
    "status" | "ossUrl" | "ephemeralUrl" | "failCode" | "model"
  >,
): boolean {
  const preview = pickTaskImagePreviewUrl(task);
  if (!preview) return false;
  if (task.status === "SUCCEEDED") return true;
  return task.status === "FAILED" && task.failCode === "OSS_UPLOAD_FAILED";
}

export function pickRuntimeImagePreviewUrl(
  runtime: Pick<CanvasNodeRuntime, "ossUrl" | "ephemeralUrl"> | undefined,
  modelKey = "",
): string | undefined {
  if (!runtime) return undefined;
  return pickTaskImagePreviewUrl({
    ossUrl: runtime.ossUrl ?? null,
    ephemeralUrl: runtime.ephemeralUrl ?? null,
    model: modelKey,
  });
}

export function taskHasDisplayableResult(
  task: Pick<
    CanvasTaskRecord,
    "status" | "ossUrl" | "ephemeralUrl" | "failCode" | "model" | "textOutput"
  >,
): boolean {
  if (task.textOutput?.trim()) return task.status === "SUCCEEDED";
  if (taskHasPreviewableImage(task)) return true;
  if (task.status === "SUCCEEDED" && pickTaskVideoUrl(task)) return true;
  return task.status === "SUCCEEDED" && !!pickTaskModelDownloadUrl(task);
}
