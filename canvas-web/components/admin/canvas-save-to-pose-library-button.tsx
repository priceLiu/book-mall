"use client";

import { useSaveToCatalog } from "@/lib/use-save-to-catalog";
import { cn } from "@/lib/utils";

type Props = {
  imageUrl: string;
  prompt?: string | null;
  sourceModule?: string;
  sourceAssetId?: string;
  onCatalogSaved?: () => void;
  className?: string;
  label?: string;
};

/** 画布成图 · 保存到全局资产库（全员） */
export function CanvasSaveToPoseLibraryButton({
  imageUrl,
  prompt,
  sourceModule = "canvas-web",
  sourceAssetId,
  onCatalogSaved,
  className,
  label = "保存到库",
}: Props) {
  const saveToCatalog = useSaveToCatalog();

  if (!imageUrl.trim()) return null;

  return (
    <button
      type="button"
      className={cn(
        "nodrag text-[10px] text-[var(--canvas-accent)] underline-offset-2 hover:underline",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        saveToCatalog({
          url: imageUrl,
          prompt,
          sourceModule,
          sourceAssetId,
          onCatalogSaved,
        });
      }}
    >
      {label}
    </button>
  );
}
