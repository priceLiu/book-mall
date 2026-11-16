"use client";

import {
  EcomSlotImageHoverActions,
  type EcomSlotImageHoverActionsProps,
} from "@/components/media/ecom-slot-image-hover-actions";
import { ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS } from "@/components/media/ecom-media-library-tile";

type Props = Omit<EcomSlotImageHoverActionsProps, "btnVariant" | "onEditPrompt"> & {
  onPreviewPrompt?: () => void;
};

/**
 * 分镜 / 详情点位成图悬停（复用电商宫格；shadow 按钮样式）。
 * @deprecated 新代码请直接用 `EcomSlotImageHoverActions`。
 */
export function StoryboardPanelImageHoverActions({
  onPreview,
  onRegenerate,
  onRefine,
  onPreviewPrompt,
  onSaveToCatalog,
  disabled,
}: Props) {
  return (
    <EcomSlotImageHoverActions
      layout="overlay"
      btnVariant="storyboard"
      onPreview={onPreview}
      onRegenerate={onRegenerate}
      onRefine={onRefine}
      onPreviewPrompt={onPreviewPrompt}
      onSaveToCatalog={onSaveToCatalog}
      disabled={disabled}
    />
  );
}

export { ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS };