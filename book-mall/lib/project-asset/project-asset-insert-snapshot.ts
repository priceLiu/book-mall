/**
 * 项目资产 insert-map · 合并 payload.nodeSnapshot
 */
import type { InsertMapResult } from "./project-asset-types";
import type { ProjectAssetRecord } from "./project-asset-types";
import { resolveAssetMediaUrl } from "./project-asset-media-resolve";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function firstMediaUrl(asset: ProjectAssetRecord): string {
  return resolveAssetMediaUrl({
    thumbnailUrl: asset.thumbnailUrl,
    refs: asset.refs,
    payload: asset.payload,
  });
}

export function mergeAssetNodeSnapshot(
  asset: ProjectAssetRecord,
  nodeType: string,
  fallback: Record<string, unknown>,
  size?: { width?: number; height?: number },
): InsertMapResult {
  const payload = asset.payload;
  const snap = payload.nodeSnapshot;
  let data: Record<string, unknown> = { ...fallback };

  if (snap && typeof snap === "object" && !Array.isArray(snap)) {
    data = { ...fallback, ...(snap as Record<string, unknown>) };
  }

  if (!str(data.label)) data.label = asset.displayName;
  const media = firstMediaUrl(asset);
  if (media && !str(data.ossUrl) && !str(data.imageUrl)) {
    data.ossUrl = media;
  }

  const resolvedType = str(payload.nodeType) || nodeType;
  return {
    nodeType: resolvedType,
    data,
    ...(size?.width ? { width: size.width } : {}),
    ...(size?.height ? { height: size.height } : {}),
  };
}

export { firstMediaUrl };
