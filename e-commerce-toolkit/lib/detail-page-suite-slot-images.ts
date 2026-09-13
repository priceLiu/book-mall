import type { EcomImagePreviewItem } from "@/lib/media/ecom-image-preview";
import type {
  DetailPageSuiteSlot,
  DetailPageSuiteSlotImageVersion,
} from "@/lib/detail-page-suite-types";

export type { DetailPageSuiteSlotImageVersion };

export function resolveDetailPageSuiteSlotHistory(
  slot: Pick<DetailPageSuiteSlot, "imageUrl" | "assetId" | "imageHistory">,
): DetailPageSuiteSlotImageVersion[] {
  if (Array.isArray(slot.imageHistory) && slot.imageHistory.length > 0) {
    return slot.imageHistory.filter((v) => v.url?.trim());
  }
  const url = slot.imageUrl?.trim();
  if (!url) return [];
  return [
    {
      url,
      assetId: slot.assetId,
      createdAt: new Date(0).toISOString(),
    },
  ];
}

export function clampDetailPageSuiteActiveImageIndex(
  index: number,
  historyLength: number,
): number {
  if (historyLength <= 0) return 0;
  if (!Number.isFinite(index)) return historyLength - 1;
  return Math.max(0, Math.min(Math.trunc(index), historyLength - 1));
}

export function resolveDetailPageSuiteActiveImageIndex(
  slot: Pick<DetailPageSuiteSlot, "activeImageIndex" | "imageUrl" | "assetId" | "imageHistory">,
): number {
  const history = resolveDetailPageSuiteSlotHistory(slot);
  if (history.length === 0) return 0;
  if (typeof slot.activeImageIndex === "number") {
    return clampDetailPageSuiteActiveImageIndex(slot.activeImageIndex, history.length);
  }
  return history.length - 1;
}

export function resolveDetailPageSuiteActiveImage(
  slot: Pick<DetailPageSuiteSlot, "activeImageIndex" | "imageUrl" | "assetId" | "imageHistory">,
): DetailPageSuiteSlotImageVersion | null {
  const history = resolveDetailPageSuiteSlotHistory(slot);
  if (history.length === 0) return null;
  return history[resolveDetailPageSuiteActiveImageIndex(slot)] ?? null;
}

export function detailPageSuiteSlotHasImage(
  slot: Pick<DetailPageSuiteSlot, "imageUrl" | "assetId" | "imageHistory">,
): boolean {
  return resolveDetailPageSuiteSlotHistory(slot).length > 0;
}

/** 点位格预览：同格多版进右侧缩略条 */
export function buildDetailPageSuiteSlotPreviewItems(
  slot: Pick<DetailPageSuiteSlot, "item_label" | "imageUrl" | "assetId" | "imageHistory">,
): EcomImagePreviewItem[] {
  const history = resolveDetailPageSuiteSlotHistory(slot);
  return history.map((v, i) => ({
    src: v.url,
    title:
      history.length > 1
        ? `${slot.item_label} · 第 ${i + 1}/${history.length} 版`
        : slot.item_label,
  }));
}
