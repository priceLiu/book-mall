/** yibaiaigc CDN 列表缩略图处理参数（与页面 HTML src 一致） */
export const YIBIAIGC_THUMB_OSS_PROCESS =
  "image/resize,mfit,s_500/quality,q_90/format,webp";

export function isYibaiAigcImageUrl(url: string): boolean {
  const base = url.split("?")[0] ?? url;
  return /^https:\/\/image\.yibaiaigc\.com\//i.test(base);
}

/** 将 HTML 中的 src 拆为原图 URL + 可直传的缩略图 URL */
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

/** 从原图 URL 推导 yibaiaigc 缩略图拉取地址 */
export function buildYibaiAigcThumbSourceUrl(originalUrl: string): string {
  const { thumbSourceUrl } = splitYibaiAigcImageUrl(originalUrl);
  return thumbSourceUrl;
}

export function resolveImageImportUrls(args: {
  sourceUrl: string;
  thumbSourceUrl?: string | null;
}): { originalUrl: string; thumbSourceUrl: string | null } {
  const source = args.sourceUrl.trim();
  if (args.thumbSourceUrl?.trim()) {
    const thumb = args.thumbSourceUrl.trim();
    const originalUrl = isYibaiAigcImageUrl(source)
      ? splitYibaiAigcImageUrl(thumb).originalUrl
      : source.split("?")[0] ?? source;
    return { originalUrl, thumbSourceUrl: thumb };
  }
  if (isYibaiAigcImageUrl(source)) {
    const split = splitYibaiAigcImageUrl(source);
    return {
      originalUrl: split.originalUrl,
      thumbSourceUrl: split.thumbSourceUrl,
    };
  }
  return { originalUrl: source.split("?")[0] ?? source, thumbSourceUrl: null };
}
