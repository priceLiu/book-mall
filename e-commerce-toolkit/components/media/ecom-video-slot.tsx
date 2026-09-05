"use client";

import { Play } from "lucide-react";

import {
  ECOM_TEMPLATE_GALLERY_TILE_ASPECT_RATIO,
  ECOM_TEMPLATE_GALLERY_TILE_WIDTH_PX,
  ECOM_WORKSPACE_GALLERY_TILE_WIDTH_PX,
} from "@/components/media/ecom-template-gallery-tile";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomVideoThumb } from "@/components/media/ecom-video-player";
import { cn } from "@/lib/utils";

/** 工作区视频格固定宽度（9:16 竖屏 · 对齐画布节点比例，不撑满栏宽） */
export const ECOM_VIDEO_SLOT_WIDTH_9_16 = 168;
export const ECOM_VIDEO_SLOT_WIDTH_9_16_COMPACT = 72;
export const ECOM_VIDEO_SLOT_WIDTH_16_9 = 240;
export const ECOM_VIDEO_SLOT_MAX_HEIGHT = 300;

export type EcomVideoSlotLayout = "default" | "compact" | "gallery" | "gallery-workspace";

export function ecomVideoSlotStyle(
  aspectRatio: "9:16" | "16:9" = "9:16",
  layout: EcomVideoSlotLayout = "default",
): {
  width: number;
  maxHeight: number;
  aspectRatio: string;
} {
  if (layout === "gallery" || layout === "gallery-workspace") {
    const width =
      layout === "gallery-workspace"
        ? ECOM_WORKSPACE_GALLERY_TILE_WIDTH_PX
        : ECOM_TEMPLATE_GALLERY_TILE_WIDTH_PX;
    return {
      width,
      maxHeight: Math.round((width * 4) / 3),
      aspectRatio: ECOM_TEMPLATE_GALLERY_TILE_ASPECT_RATIO,
    };
  }
  const width =
    aspectRatio === "16:9"
      ? ECOM_VIDEO_SLOT_WIDTH_16_9
      : layout === "compact"
        ? ECOM_VIDEO_SLOT_WIDTH_9_16_COMPACT
        : ECOM_VIDEO_SLOT_WIDTH_9_16;
  return {
    width,
    maxHeight: layout === "compact" ? 128 : ECOM_VIDEO_SLOT_MAX_HEIGHT,
    aspectRatio: aspectRatio === "16:9" ? "16 / 9" : "9 / 16",
  };
}

function playButtonClass(size: "sm" | "md" | "lg"): string {
  if (size === "sm") {
    return "flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/60 shadow-md";
  }
  if (size === "md") {
    return "flex size-12 items-center justify-center rounded-full border border-white/25 bg-black/60 shadow-lg";
  }
  return "flex size-14 items-center justify-center rounded-full border border-white/25 bg-black/60 shadow-lg transition-transform group-hover/video:scale-105";
}

function playIconClass(size: "sm" | "md" | "lg"): string {
  if (size === "sm") return "ml-0.5 size-4 fill-white text-white";
  if (size === "md") return "ml-0.5 size-5 fill-white text-white";
  return "ml-1 size-7 fill-white text-white";
}

type Props = {
  src?: string | null;
  aspectRatio?: "9:16" | "16:9";
  onPreview?: () => void;
  generating?: boolean;
  generatingPosterUrl?: string;
  emptyLabel?: string;
  playSize?: "sm" | "md" | "lg";
  /** @deprecated 用 layout="compact" */
  compact?: boolean;
  /** gallery = 模板区单格 3:4 */
  layout?: EcomVideoSlotLayout;
  className?: string;
};

/** 固定尺寸视频格 · 黑底 fill · 圆形播放钮（对齐 canvas sbv1 视频节点） */
export function EcomVideoSlot({
  src,
  aspectRatio = "9:16",
  onPreview,
  generating = false,
  generatingPosterUrl,
  emptyLabel = "待生成",
  playSize = "lg",
  compact = false,
  layout,
  className,
}: Props) {
  const resolvedLayout: EcomVideoSlotLayout =
    layout ?? (compact ? "compact" : "default");
  const slot = ecomVideoSlotStyle(aspectRatio, resolvedLayout);

  return (
    <div
      className={cn(
        "group/video relative shrink-0 overflow-hidden bg-black",
        resolvedLayout === "gallery" || resolvedLayout === "gallery-workspace"
          ? "rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]"
          : undefined,
        className,
      )}
      style={{
        width: slot.width,
        maxHeight: slot.maxHeight,
        aspectRatio: slot.aspectRatio,
      }}
    >
      {generating ? (
        <>
          {generatingPosterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={generatingPosterUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
          <EcomMediaGeneratingBusy className="absolute inset-0" />
        </>
      ) : src?.trim() ? (
        <>
          <EcomVideoThumb src={src} className="absolute inset-0 size-full" />
          {onPreview ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <button
                type="button"
                aria-label="播放视频"
                title="播放视频"
                className={playButtonClass(playSize)}
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
              >
                <Play className={playIconClass(playSize)} />
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex size-full items-center justify-center px-2 text-center text-[10px] text-[#86868b]">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
