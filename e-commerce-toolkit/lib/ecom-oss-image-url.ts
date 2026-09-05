/** 列表缩略图宽度（6 列网格 × 2x DPR ≈ 480） */
export const ECOM_OSS_THUMB_WIDTH = 480;

/** 预览弹层最大宽（比原图小、比缩略图清晰） */
export const ECOM_OSS_PREVIEW_WIDTH = 1600;

const ALIYUN_OSS_HOST = /\.aliyuncs\.com$/i;

export function isAliyunOssUrl(url: string): boolean {
  try {
    const host = new URL(url.split("?")[0] ?? url).hostname;
    return ALIYUN_OSS_HOST.test(host);
  } catch {
    return false;
  }
}

type OssImageOpts = {
  width: number;
  quality?: number;
  format?: "webp" | "jpg";
};

/**
 * 阿里云 OSS 图片处理（缩略 / 转 WebP）。
 * 非 OSS URL 原样返回。
 */
export function buildEcomOssImageUrl(url: string, opts: OssImageOpts): string {
  const base = url.split("?")[0] ?? url;
  if (!isAliyunOssUrl(base)) return url;

  const quality = opts.quality ?? 85;
  const format = opts.format ?? "webp";
  const process = `image/resize,w_${opts.width},m_lfit/format,${format}/quality,q_${quality}`;
  return `${base}?x-oss-process=${process}`;
}

export function buildEcomOssThumbUrl(url: string, bakedThumbUrl?: string | null): string {
  if (bakedThumbUrl?.trim()) return bakedThumbUrl.trim();
  return buildEcomOssImageUrl(url, { width: ECOM_OSS_THUMB_WIDTH });
}

export function buildEcomOssPreviewUrl(url: string): string {
  return buildEcomOssImageUrl(url, { width: ECOM_OSS_PREVIEW_WIDTH });
}
