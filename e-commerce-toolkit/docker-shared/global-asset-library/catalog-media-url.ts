import type { GlobalAssetPickItem } from "./types";

type CatalogMediaItem = Pick<GlobalAssetPickItem, "thumbUrl" | "ossUrl" | "promptOnly">;

/** 列表 / 网格 · 优先缩略图（回填前可暂回落 ossUrl） */
export function resolveGlobalAssetThumbUrl(item: CatalogMediaItem): string {
  if (item.promptOnly) return item.ossUrl?.trim() ?? "";
  const thumb = item.thumbUrl?.trim();
  if (thumb) return thumb;
  return item.ossUrl?.trim() ?? "";
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
