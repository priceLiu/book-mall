"use client";

import { Archive, Eye, FileText, RefreshCw, Sparkles } from "lucide-react";

import {
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS,
  ECOM_SLOT_HOVER_OVERLAY_CLASS,
  ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { cn } from "@/lib/utils";

type Props = {
  onPreview?: () => void;
  onRegenerate?: () => void;
  onRefine?: () => void;
  onPreviewPrompt?: () => void;
  onSaveToCatalog?: () => void;
  disabled?: boolean;
  btnClass?: string;
};

function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

/**
 * 分镜图悬停操作：预览 / 重新生成 / 提示词预览（仅图标，无文字）。
 */
export function StoryboardPanelImageHoverActions({
  onPreview,
  onRegenerate,
  onRefine,
  onPreviewPrompt,
  onSaveToCatalog,
  disabled,
  btnClass = ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
}: Props) {
  if (!onPreview && !onRegenerate && !onRefine && !onPreviewPrompt && !onSaveToCatalog) {
    return null;
  }

  const actionBtnClass = cn(btnClass, disabled && "pointer-events-none opacity-50");

  return (
    <>
      <div aria-hidden className={ECOM_SLOT_HOVER_OVERLAY_CLASS} />
      <div className={ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS}>
        {onPreview ? (
          <button
            type="button"
            title="预览"
            aria-label="预览"
            className={cn(actionBtnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onPreview();
            }}
          >
            <Eye className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onRegenerate ? (
          <button
            type="button"
            title="重新生成"
            aria-label="重新生成"
            className={cn(actionBtnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onRegenerate();
            }}
          >
            <RefreshCw className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onRefine ? (
          <button
            type="button"
            title="精修"
            aria-label="精修"
            className={cn(actionBtnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onRefine();
            }}
          >
            <Sparkles className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onPreviewPrompt ? (
          <button
            type="button"
            title="提示词编辑"
            aria-label="提示词编辑"
            className={cn(actionBtnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onPreviewPrompt();
            }}
          >
            <FileText className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onSaveToCatalog ? (
          <button
            type="button"
            title="保存到库"
            aria-label="保存到库"
            className={cn(actionBtnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onSaveToCatalog();
            }}
          >
            <Archive className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
      </div>
    </>
  );
}
