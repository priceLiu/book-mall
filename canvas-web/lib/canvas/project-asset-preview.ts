import type { ProjectAssetRecord } from "./project-asset-types";
import {
  collectProjectAssetMediaItems,
  isHttpMediaUrl,
} from "./project-asset-media-url";

/** 卡片主图：汇总全部来源后的首张 */
export function projectAssetHeroUrl(
  asset: Pick<
    ProjectAssetRecord,
    "kind" | "displayName" | "thumbnailUrl" | "refs" | "payload"
  >,
): string | undefined {
  return collectProjectAssetMediaItems(asset)[0]?.url;
}

export type ProjectAssetRefSnapshot = {
  id: string;
  url: string;
  label: string;
  mimeType: string | null;
};

/** 多槽 ref 快照（含 layout 子节点） */
export function projectAssetRefSnapshots(
  asset: Pick<
    ProjectAssetRecord,
    "kind" | "refs" | "thumbnailUrl" | "displayName" | "payload"
  >,
): ProjectAssetRefSnapshot[] {
  return collectProjectAssetMediaItems(asset).map((item) => ({
    id: item.id,
    url: item.url,
    label: item.label,
    mimeType: item.mimeType,
  }));
}

export function projectAssetHoverPreviewUrl(
  asset: Pick<
    ProjectAssetRecord,
    "kind" | "displayName" | "thumbnailUrl" | "refs" | "payload"
  >,
  preferredUrl?: string,
): string | undefined {
  if (isHttpMediaUrl(preferredUrl)) return preferredUrl.trim();
  return projectAssetHeroUrl(asset);
}

export function isProjectAssetVideoUrl(
  url: string,
  mimeType?: string | null,
): boolean {
  if (mimeType?.startsWith("video/")) return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}
