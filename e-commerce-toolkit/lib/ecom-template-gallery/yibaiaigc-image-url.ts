/** yibaiaigc CDN 列表缩略图处理参数（与页面 HTML src 一致） */
export const YIBIAIGC_THUMB_OSS_PROCESS =
  "image/resize,mfit,s_500/quality,q_90/format,webp";

export function isYibaiAigcImageUrl(url: string): boolean {
  const base = url.split("?")[0] ?? url;
  return /^https:\/\/image\.yibaiaigc\.com\//i.test(base);
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
