"use client";

import { Eye, FileText, RefreshCw } from "lucide-react";

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
  onPreviewPrompt?: () => void;
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
  onPreviewPrompt,
  btnClass = ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
}: Props) {
  if (!onPreview && !onRegenerate && !onPreviewPrompt) return null;

  return (
    <>
      <div aria-hidden className={ECOM_SLOT_HOVER_OVERLAY_CLASS} />
      <div className={ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS}>
        {onPreview ? (
          <button
            type="button"
            title="预览"
            aria-label="预览"
            className={cn(btnClass, "pointer-events-auto")}
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
            className={cn(btnClass, "pointer-events-auto")}
            onClick={(e) => {
              stopClick(e);
              onRegenerate();
            }}
          >
            <RefreshCw className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onPreviewPrompt ? (
          <button
            type="button"
            title="提示词预览"
            aria-label="提示词预览"
            className={cn(btnClass, "pointer-events-auto")}
            onClick={(e) => {
              stopClick(e);
              onPreviewPrompt();
            }}
          >
            <FileText className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
      </div>
    </>
  );
}
