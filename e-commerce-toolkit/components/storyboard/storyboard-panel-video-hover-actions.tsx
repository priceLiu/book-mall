"use client";

import { Play, RefreshCw } from "lucide-react";

import {
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { cn } from "@/lib/utils";

type Props = {
  onPreview?: () => void;
  onRegenerate?: () => void;
};

function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

/** 单镜视频悬停：播放 / 重新生成（仅图标） */
export function StoryboardPanelVideoHoverActions({ onPreview, onRegenerate }: Props) {
  if (!onPreview && !onRegenerate) return null;

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
            className={cn(ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS, "pointer-events-auto")}
            onClick={(e) => {
              stopClick(e);
              onPreview();
            }}
          >
            <Play className={cn(ECOM_MEDIA_TILE_ACTION_ICON_CLASS, "ml-0.5 fill-current")} />
          </button>
        ) : null}
        {onRegenerate ? (
          <button
            type="button"
            title="重新生成"
            aria-label="重新生成"
            className={cn(ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS, "pointer-events-auto")}
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
