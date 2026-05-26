"use client";

import type { ReactNode } from "react";
import { Play, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

/** 与分镜视频列 StoryVideoRowSlot 一致：原生 video 缩略 + 居中播放钮，点击由父级弹层播放 */
export function CanvasVideoPreviewSlot({
  videoUrl,
  generating,
  onPreview,
  className,
  emptyIcon,
  emptyMessage,
}: {
  videoUrl?: string;
  generating?: boolean;
  onPreview?: () => void;
  className?: string;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
}) {
  const hasVideo = Boolean(videoUrl);

  return (
    <div
      className={cn(
        "group relative min-h-0 w-full overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a]",
        generating && "canvas-story-media-generating border-[#fb923c]/50",
        className,
      )}
    >
      {hasVideo ? (
        <video
          src={videoUrl}
          className="absolute inset-0 size-full object-cover object-center"
          playsInline
          muted
          preload="metadata"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-black/40" />
      )}

      {!hasVideo && (emptyIcon || emptyMessage) ? (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-4 text-white/40">
          {emptyIcon}
          {emptyMessage ? (
            <span className="text-[11px]">{emptyMessage}</span>
          ) : null}
        </div>
      ) : null}

      {generating ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
          <RefreshCw className="size-8 animate-spin text-[#fdba74]" />
        </div>
      ) : null}

      {hasVideo && !generating && onPreview ? (
        <button
          type="button"
          aria-label="播放"
          className="nodrag absolute inset-0 z-10 flex items-center justify-center"
          onClick={onPreview}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-white/25 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105">
            <Play className="ml-0.5 size-5 fill-white text-white" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
