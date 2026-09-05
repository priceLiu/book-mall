"use client";

import { useCallback, useEffect, useState } from "react";

import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import {
  buildEcomImagePreviewOpenState,
  type EcomImagePreviewItem,
  type EcomImagePreviewOpenState,
} from "@/lib/media/ecom-image-preview";

/**
 * 管理同页多图预览状态：打开时传入当前图 + 可选同组 items，右侧缩略条可切换。
 */
export function useEcomImagePreview(initialGallery: EcomImagePreviewItem[] = []) {
  const [galleryItems, setGalleryItems] =
    useState<EcomImagePreviewItem[]>(initialGallery);
  const [preview, setPreview] = useState<EcomImagePreviewOpenState | null>(null);

  useEffect(() => {
    setGalleryItems(initialGallery);
  }, [initialGallery]);

  const openPreview = useCallback(
    (src: string, title: string, items?: readonly EcomImagePreviewItem[]) => {
      const gallery =
        items && items.length > 0 ? [...items] : galleryItems;
      if (items && items.length > 0) {
        setGalleryItems([...items]);
      }
      setPreview(buildEcomImagePreviewOpenState(src, title, gallery));
    },
    [galleryItems],
  );

  const closePreview = useCallback(() => setPreview(null), []);

  return {
    galleryItems,
    setGalleryItems,
    preview,
    openPreview,
    closePreview,
    isPreviewOpen: preview != null,
  };
}

/** 与 `useEcomImagePreview` 配套挂载，避免各页重复写 Dialog props */
export function EcomImagePreviewHost({
  preview,
  galleryItems,
  onClose,
  nativeOverlay = false,
}: {
  preview: EcomImagePreviewOpenState | null;
  galleryItems?: readonly EcomImagePreviewItem[];
  onClose: () => void;
  /** 嵌套在其它 Radix Dialog 内时须为 true，避免 Presence 循环 */
  nativeOverlay?: boolean;
}) {
  if (!preview) return null;

  const items =
    galleryItems && galleryItems.length > 0 ? [...galleryItems] : undefined;

  return (
    <EcomImagePreviewDialog
      src={preview.fallbackSrc}
      title={preview.fallbackTitle}
      items={items}
      initialIndex={preview.initialIndex}
      open
      nativeOverlay={nativeOverlay}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    />
  );
}
