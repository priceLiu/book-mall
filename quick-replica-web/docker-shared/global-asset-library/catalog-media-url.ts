import type { GlobalAssetPickItem } from "./types";

type CatalogMediaItem = Pick<
  GlobalAssetPickItem,
  "thumbUrl" | "ossUrl" | "promptOnly" | "catalogKind"
>;

/** 场景库 · 无图/坏图回退（与 book-mall `ecom-scene-library-display` 一致） */
export const GLOBAL_ASSET_SCENE_CATALOG_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"><rect width="120" height="160" fill="#ebebed"/><text x="60" y="72" text-anchor="middle" fill="#86868b" font-size="11" font-family="sans-serif">场景</text><text x="60" y="92" text-anchor="middle" fill="#aeaeb2" font-size="9" font-family="sans-serif">参考</text></svg>',
  );

export function isSceneCatalogItem(item: Pick<GlobalAssetPickItem, "catalogKind">): boolean {
  return item.catalogKind === "scene";
}

/** 平台 Hub · 无有效图片时走「提示词卡片」布局（含仅占位 SVG 的历史数据） */
export function globalAssetCatalogPromptFirstLayout(
  item: Pick<GlobalAssetPickItem, "promptOnly" | "ossUrl" | "thumbUrl" | "catalogKind">,
): boolean {
  if (item.promptOnly) return true;
  const url = item.thumbUrl?.trim() || item.ossUrl?.trim() || "";
  if (!url) return true;
  if (url === GLOBAL_ASSET_SCENE_CATALOG_PLACEHOLDER) return true;
  if (
    item.catalogKind === "pose" &&
    url.startsWith("data:image/svg+xml") &&
    url.includes("姿势")
  ) {
    return true;
  }
  return false;
}

export function globalAssetCatalogCopyPromptText(
  item: Pick<GlobalAssetPickItem, "description" | "subtitle" | "title">,
): string {
  return item.description?.trim() || item.subtitle?.trim() || item.title.trim();
}

export function globalAssetCatalogHasCopyPrompt(
  item: Pick<GlobalAssetPickItem, "description" | "subtitle">,
): boolean {
  return Boolean(item.description?.trim() || item.subtitle?.trim());
}

/** 列表 / 网格 · 优先缩略图（回填前可暂回落 ossUrl） */
export function resolveGlobalAssetThumbUrl(item: CatalogMediaItem): string {
  if (item.promptOnly) return item.ossUrl?.trim() ?? "";
  const thumb = item.thumbUrl?.trim();
  if (thumb) return thumb;
  const oss = item.ossUrl?.trim();
  if (oss) return oss;
  if (isSceneCatalogItem(item)) return GLOBAL_ASSET_SCENE_CATALOG_PLACEHOLDER;
  return "";
}

/** 放大预览 · 始终主图 */
export function resolveGlobalAssetPreviewUrl(
  item: Pick<GlobalAssetPickItem, "ossUrl">,
): string {
  return item.ossUrl?.trim() ?? "";
}

/** 选中 / 生图 / AI 引用 · 始终主图 */
export function resolveGlobalAssetModelUrl(
  item: Pick<GlobalAssetPickItem, "ossUrl">,
): string {
  return item.ossUrl?.trim() ?? "";
}
