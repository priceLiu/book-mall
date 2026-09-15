/** 与 canvas-web/lib/canvas/task-media-url.ts 判定规则保持一致 */

const VIDEO_EXT = /\.(mp4|mov)(\?|#|$)/i;
const RASTER_EXT = /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i;

export function isLikelyVideoUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return VIDEO_EXT.test(u) || u.includes("/node-video/");
}

const MODEL_EXT = /\.(glb|gltf|obj|fbx|stl|usdz|mp4)(\?|#|$)/i;

function isLikelyModelMediaUrl(url: string): boolean {
  return MODEL_EXT.test(url.trim());
}

/** DashScope reference_image · 明确排除视频/3D */
export function isLikelyReferenceImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u || !/^https?:\/\//.test(u)) return false;
  if (isLikelyVideoUrl(u)) return false;
  if (isLikelyModelMediaUrl(u)) return false;
  if (RASTER_EXT.test(u)) return true;
  if (u.includes("/node-image/")) return true;
  return true;
}
