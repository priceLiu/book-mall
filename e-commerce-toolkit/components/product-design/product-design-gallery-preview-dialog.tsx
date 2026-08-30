"use client";

import { useMemo } from "react";

import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import { mapPreviewItemsFromEntries } from "@/lib/media/ecom-image-preview";

export type ProductDesignGalleryPreviewItem = {
  url: string;
  title: string;
  ratio?: string;
  downloadFilename?: string;
};

/**
 * @deprecated 请优先使用 `EcomImagePreviewDialog` + `items`（含缩放/平移 + 右侧缩略条）。
 * 本组件保留兼容入口，内部已委托统一预览。
 */
export function ProductDesignGalleryPreviewDialog({
  items,
  initialIndex = 0,
  open,
  onOpenChange,
}: {
  items: ProductDesignGalleryPreviewItem[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mapped = useMemo(
    () => mapPreviewItemsFromEntries(items.map((i) => ({ url: i.url, title: i.title }))),
    [items],
  );
  const active = mapped[Math.min(Math.max(0, initialIndex), Math.max(0, mapped.length - 1))];

  if (!active) return null;

  return (
    <EcomImagePreviewDialog
      src={active.src}
      title={active.title}
      items={mapped.length > 1 ? mapped : undefined}
      initialIndex={initialIndex}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
