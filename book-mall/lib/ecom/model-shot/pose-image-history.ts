import type { ModelShotPoseImageVersion, ModelShotPoseItem } from "@/lib/ecom/ecom-model-shot-types";

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

export function appendModelShotPoseImage(
  item: ModelShotPoseItem,
  version: Omit<ModelShotPoseImageVersion, "createdAt"> & { createdAt?: string },
): ModelShotPoseItem {
  const history = resolveModelShotPoseImageHistory(item);
  const nextHistory: ModelShotPoseImageVersion[] = [
    ...history,
    {
      url: version.url,
      assetId: version.assetId,
      createdAt: version.createdAt ?? new Date().toISOString(),
    },
  ];
  const activeImageIndex = nextHistory.length - 1;
  const active = nextHistory[activeImageIndex]!;
  return {
    ...item,
    imageHistory: nextHistory,
    activeImageIndex,
    imageUrl: active.url,
    assetId: active.assetId,
  };
}

export function withModelShotActiveImageIndex(
  item: ModelShotPoseItem,
  activeImageIndex: number,
): ModelShotPoseItem {
  const history = resolveModelShotPoseImageHistory(item);
  if (history.length === 0) return item;
  const idx = clampModelShotActiveImageIndex(activeImageIndex, history.length);
  const active = history[idx]!;
  return {
    ...item,
    imageHistory: history,
    activeImageIndex: idx,
    imageUrl: active.url,
    assetId: active.assetId,
  };
}
