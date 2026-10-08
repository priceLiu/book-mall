import { buildEcomSceneLibraryPlatformDefaultOssKey } from "@/lib/canvas/canvas-constants";
import { ossPublicUrlForKeyFromEnv } from "@/lib/canvas/canvas-oss";

/** 场景库 · 无参考图时的 SVG 占位（OSS 默认图不可用时） */
export const ECOM_SCENE_LIBRARY_PLACEHOLDER_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"><rect width="120" height="160" fill="#ebebed"/><text x="60" y="72" text-anchor="middle" fill="#86868b" font-size="11" font-family="sans-serif">场景</text><text x="60" y="92" text-anchor="middle" fill="#aeaeb2" font-size="9" font-family="sans-serif">参考</text></svg>',
  );

export type EcomSceneLibraryImageFields = {
  ossUrl?: string | null;
  thumbUrl?: string | null;
};

export function resolveEcomSceneLibraryPlatformDefaultImageUrl(): string {
  try {
    const url = ossPublicUrlForKeyFromEnv(buildEcomSceneLibraryPlatformDefaultOssKey());
    if (url?.trim()) return url.trim();
  } catch {
    /* OSS 未配置 */
  }
  return ECOM_SCENE_LIBRARY_PLACEHOLDER_SVG;
}

/** 列表/卡片展示用：自有图优先；无图或仅 OSS 占位键未上传时用 SVG 默认图（避免坏链） */
export function resolveEcomSceneLibraryDisplayImageUrl(
  entry: EcomSceneLibraryImageFields,
): string {
  const own = entry.thumbUrl?.trim() || entry.ossUrl?.trim();
  if (own) return own;
  return ECOM_SCENE_LIBRARY_PLACEHOLDER_SVG;
}

export function sceneLibraryEntryHasOwnImage(entry: EcomSceneLibraryImageFields): boolean {
  return Boolean(entry.thumbUrl?.trim() || entry.ossUrl?.trim());
}
