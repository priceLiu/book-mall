"use client";

import type { EcomCopyLayoutReferenceImage } from "@/components/copy-layout/ecom-copy-layout-studio-dialog";
import {
  DetailPageSuiteSlotPromptEditDialog,
  type DetailPageSuiteSlotPromptSaveExtras,
} from "@/components/detail-page-suite/detail-page-suite-slot-prompt-edit-dialog";
import { composeEcomCopyOverlay } from "@/lib/ecom-copy-overlay-compose-api";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { EcomDetailPageRatio } from "@/lib/detail-page-suite-platform-ratio";
import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  prompt: string;
  baseImageUrl: string | null;
  slotCopy?: string;
  slotCopyAi?: string;
  copyOverlay?: EcomCopyOverlay | null;
  ratio: string;
  exportWidthPx?: number;
  referenceImages?: EcomPromptImageRef[];
  onSave: (prompt: string, extras?: DetailPageSuiteSlotPromptSaveExtras) => void | Promise<void>;
  onConfirmCompose?: (
    prompt: string,
    extras: DetailPageSuiteSlotPromptSaveExtras,
    previewUrl: string,
  ) => void | Promise<void>;
  onRegenerateImage?: (prompt: string) => void | Promise<void>;
  onRewrite?: () => void;
  rewriteBusy?: boolean;
  disabled?: boolean;
};

/** 主图 / 商品套图 / 详情分屏 · 与详情页套图同款全屏排版编辑 */
export function ProductDesignGenSlotEditDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  prompt,
  baseImageUrl,
  slotCopy = "",
  slotCopyAi = "",
  copyOverlay = null,
  ratio,
  exportWidthPx = 750,
  referenceImages = [],
  onSave,
  onConfirmCompose,
  onRegenerateImage,
  onRewrite,
  rewriteBusy,
  disabled,
}: Props) {
  const refs: EcomCopyLayoutReferenceImage[] = referenceImages.map((r, i) => ({
    url: r.url,
    label: r.label ?? `参考 ${i + 1}`,
  }));
  const displayRatio = (
    ratio === "1:1" ||
    ratio === "3:4" ||
    ratio === "4:5" ||
    ratio === "9:16" ||
    ratio === "16:9"
      ? ratio
      : "1:1"
  ) as EcomDetailPageRatio;

  return (
    <DetailPageSuiteSlotPromptEditDialog
      open={open}
      onOpenChange={onOpenChange}
      title={subtitle ? `${title} · ${subtitle}` : title}
      shootingRequirement={subtitle}
      prompt={prompt}
      slotCopy={slotCopy}
      slotCopyAi={slotCopyAi}
      showSlotCopyField
      baseImageUrl={baseImageUrl}
      copyOverlay={copyOverlay}
      exportWidthPx={exportWidthPx}
      displayRatio={displayRatio}
      rewriteBusy={rewriteBusy}
      onRewrite={onRewrite}
      onRegenerateImage={disabled ? undefined : onRegenerateImage}
      referenceImages={refs}
      onSave={onSave}
      onPreview={async (_p, extras) => {
        const baseUrl = baseImageUrl?.trim();
        if (!baseUrl || !extras.copyOverlay) return;
        const { url } = await composeEcomCopyOverlay({
          baseImageUrl: baseUrl,
          overlay: extras.copyOverlay,
          exportWidthPx,
          syncText: extras.slotCopy,
        });
        return { previewUrl: url };
      }}
      onConfirmCompose={
        onConfirmCompose
          ? async (p, extras) => {
              const baseUrl = baseImageUrl?.trim();
              if (!baseUrl || !extras.copyOverlay) return;
              const { url } = await composeEcomCopyOverlay({
                baseImageUrl: baseUrl,
                overlay: extras.copyOverlay,
                exportWidthPx,
                syncText: extras.slotCopy,
              });
              await onConfirmCompose(p, extras, url);
            }
          : undefined
      }
    />
  );
}
