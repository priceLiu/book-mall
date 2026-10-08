import type { EcomSceneLibraryEntry } from "./types";

/** 与 book-mall `ecom-scene-library-display` 一致的 SVG 占位 */
export const ECOM_SCENE_LIBRARY_PLACEHOLDER_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"><rect width="120" height="160" fill="#ebebed"/><text x="60" y="72" text-anchor="middle" fill="#86868b" font-size="11" font-family="sans-serif">场景</text><text x="60" y="92" text-anchor="middle" fill="#aeaeb2" font-size="9" font-family="sans-serif">参考</text></svg>',
  );

export function resolveSceneLibraryCardImageUrl(entry: EcomSceneLibraryEntry): string {
  const own = entry.thumbUrl?.trim() || entry.ossUrl?.trim();
  if (own) return own;
  return ECOM_SCENE_LIBRARY_PLACEHOLDER_SVG;
}

export function sceneLibraryEntryHasOwnImage(entry: EcomSceneLibraryEntry): boolean {
  return Boolean(entry.thumbUrl?.trim() || entry.ossUrl?.trim());
}
