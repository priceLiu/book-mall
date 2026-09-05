/** yibaiaigc CDN 列表缩略图处理参数（与页面 HTML src 一致） */
export const YIBIAIGC_THUMB_OSS_PROCESS =
  "image/resize,mfit,s_500/quality,q_90/format,webp";

export function isYibaiAigcImageUrl(url: string): boolean {
  const base = url.split("?")[0] ?? url;
  return /^https:\/\/image\.yibaiaigc\.com\//i.test(base);
}

/**
 * 视频列表页保存下来的 HTML 里 `<video src>` 为空（hover 时才由前端填充），
 * 但视频与封面图同名、仅扩展名不同，故由封面 URL 推导。
 */
export function deriveVideoUrlFromCoverUrl(
  coverUrl: string,
  ext = "mp4",
): string {
  const base = (coverUrl.split("?")[0] ?? "").trim();
  if (!base) return "";
  return /\.[^./]+$/.test(base)
    ? base.replace(/\.[^./]+$/, `.${ext}`)
    : `${base}.${ext}`;
}

export function splitYibaiAigcImageUrl(rawUrl: string): {
  originalUrl: string;
  thumbSourceUrl: string;
} {
  const trimmed = rawUrl.trim();
  const qIdx = trimmed.indexOf("?");
  const originalUrl = qIdx >= 0 ? trimmed.slice(0, qIdx) : trimmed;

  if (qIdx >= 0) {
    const query = trimmed.slice(qIdx + 1);
    if (query.includes("x-oss-process") && /format,webp/i.test(query)) {
      return { originalUrl, thumbSourceUrl: trimmed };
    }
  }

  return {
    originalUrl,
    thumbSourceUrl: `${originalUrl}?x-oss-process=${YIBIAIGC_THUMB_OSS_PROCESS}`,
  };
}
