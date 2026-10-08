import type { GlobalAssetPickItem } from "@/docker-shared/global-asset-library/types";
import {
  globalAssetCatalogHasCopyPrompt,
  globalAssetCatalogPromptFirstLayout,
  resolveGlobalAssetPreviewUrl,
  resolveGlobalAssetThumbUrl,
} from "@/docker-shared/global-asset-library/catalog-media-url";

export function platformCatalogPromptFirst(item: GlobalAssetPickItem): boolean {
  return globalAssetCatalogPromptFirstLayout(item);
}

export function platformCatalogPreviewUrl(item: GlobalAssetPickItem): string {
  if (platformCatalogPromptFirst(item)) return "";
  return resolveGlobalAssetPreviewUrl(item) || resolveGlobalAssetThumbUrl(item);
}

export function platformCatalogHasPromptCopy(item: GlobalAssetPickItem): boolean {
  return globalAssetCatalogHasCopyPrompt(item);
}

export function platformCatalogPromptBody(item: GlobalAssetPickItem): string {
  return (
    item.description?.trim() ||
    item.subtitle?.trim() ||
    item.title
  );
}
