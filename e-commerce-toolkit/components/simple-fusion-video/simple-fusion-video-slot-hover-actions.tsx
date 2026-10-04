"use client";

import { Download, Play, RefreshCw } from "lucide-react";

import {
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { cn } from "@/lib/utils";

type Props = {
  onPreview?: () => void;
  onDownload?: () => void;
  onRegenerate?: () => void;
  disabled?: boolean;
};

function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

/** 工作区视频片段格悬停操作（预览 / 下载 / 重新生成） */
export function SimpleFusionVideoSlotHoverActions({
  onPreview,
  onDownload,
  onRegenerate,
  disabled,
}: Props) {
  if (!onPreview && !onDownload && !onRegenerate) return null;

  const hitClass =
    "pointer-events-none group-hover/video-hover:pointer-events-auto";
  const viewBtnClass = cn(ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS, hitClass);
  const mutateBtnClass = cn(
    ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
    hitClass,
    disabled && "opacity-50",
  );

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-black/45 opacity-0 transition-opacity duration-150 group-hover/video-hover:opacity-100"
      />
      <div className="pointer-events-none absolute inset-0 z-20 flex max-w-full flex-wrap items-center justify-center gap-1.5 overflow-hidden px-1 opacity-0 transition-opacity duration-150 group-hover/video-hover:opacity-100 sm:gap-2">
        {onPreview ? (
          <button
            type="button"
            title="播放"
            aria-label="播放"
            className={viewBtnClass}
            onClick={(e) => {
              stopClick(e);
              onPreview();
            }}
          >
            <Play className={cn(ECOM_MEDIA_TILE_ACTION_ICON_CLASS, "ml-0.5 fill-current")} />
          </button>
        ) : null}
        {onDownload ? (
          <button
            type="button"
            title="下载"
            aria-label="下载"
            className={viewBtnClass}
            onClick={(e) => {
              stopClick(e);
              onDownload();
            }}
          >
            <Download className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onRegenerate ? (
          <button
            type="button"
            title="重新生成"
            aria-label="重新生成"
            className={mutateBtnClass}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onRegenerate();
            }}
          >
            <RefreshCw className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
      </div>
    </>
  );
}
