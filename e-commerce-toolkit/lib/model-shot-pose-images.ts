import type { ModelShotPoseImageVersion, ModelShotPoseItem } from "@/lib/model-shot-types";

export type { ModelShotPoseImageVersion };

export function modelShotPoseHasGeneratedImage(
  item: Pick<ModelShotPoseItem, "imageUrl" | "assetId" | "imageHistory">,
): boolean {
  return resolveModelShotPoseImageHistory(item).length > 0;
}

export function resolveModelShotPoseImageHistory(
  item: Pick<ModelShotPoseItem, "imageUrl" | "assetId" | "imageHistory">,
): ModelShotPoseImageVersion[] {
  if (Array.isArray(item.imageHistory) && item.imageHistory.length > 0) {
    return item.imageHistory.filter((v) => v.url?.trim());
  }
  const url = item.imageUrl?.trim();
  if (!url) return [];
  return [
    {
      url,
      assetId: item.assetId,
      createdAt: new Date(0).toISOString(),
    },
  ];
}

export function clampModelShotActiveImageIndex(
  index: number,
  historyLength: number,
): number {
  if (historyLength <= 0) return 0;
  if (!Number.isFinite(index)) return historyLength - 1;
  return Math.max(0, Math.min(Math.trunc(index), historyLength - 1));
}

export function resolveModelShotActiveImageIndex(
  item: Pick<ModelShotPoseItem, "activeImageIndex" | "imageUrl" | "assetId" | "imageHistory">,
): number {
  const history = resolveModelShotPoseImageHistory(item);
  if (history.length === 0) return 0;
  if (typeof item.activeImageIndex === "number") {
    return clampModelShotActiveImageIndex(item.activeImageIndex, history.length);
  }
  return history.length - 1;
}

export function resolveModelShotActiveImage(
  item: Pick<
    ModelShotPoseItem,
    "activeImageIndex" | "imageUrl" | "assetId" | "imageHistory"
  >,
): ModelShotPoseImageVersion | null {
  const history = resolveModelShotPoseImageHistory(item);
  if (history.length === 0) return null;
  return history[resolveModelShotActiveImageIndex(item)] ?? null;
}

export type ModelShotGeneratedImageEntry = {
  poseIndex: number;
  poseTitle: string;
  versionIndex: number;
  versionCount: number;
  url: string;
  createdAt: string;
};

export function listModelShotAllGeneratedImages(
  items: readonly ModelShotPoseItem[],
): ModelShotGeneratedImageEntry[] {
  const out: ModelShotGeneratedImageEntry[] = [];
  for (const item of items) {
    const history = resolveModelShotPoseImageHistory(item);
    const title = item.title?.trim() || `姿势 ${item.index}`;
    history.forEach((version, versionIndex) => {
      out.push({
        poseIndex: item.index,
        poseTitle: title,
        versionIndex,
        versionCount: history.length,
        url: version.url,
        createdAt: version.createdAt,
      });
    });
  }
  return out.sort((a, b) => {
    if (a.poseIndex !== b.poseIndex) return a.poseIndex - b.poseIndex;
    return a.versionIndex - b.versionIndex;
  });
}
