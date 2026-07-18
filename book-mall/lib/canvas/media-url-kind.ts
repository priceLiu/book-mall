/** 与 canvas-web/lib/canvas/task-media-url.ts 判定规则保持一致 */

const VIDEO_EXT = /\.mp4(\?|#|$)/i;

export function isLikelyVideoUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return VIDEO_EXT.test(u) || u.includes("/node-video/");
}
