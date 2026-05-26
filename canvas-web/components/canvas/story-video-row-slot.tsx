"use client";

import { Film, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORY_VIDEO_SLOT } from "@/lib/canvas/story-column-layout";

/** 分镜视频列 · 纵向成片（无边框，固定格高） */
export function StoryVideoRowSlot({
  frameIndex,
  videoUrl,
  generating,
  generateTitle = "按分镜脚本重新生成",
  onGenerate,
  onPreview,
}: {
  frameIndex: number;
  videoUrl?: string;
  generating?: boolean;
  generateTitle?: string;
  onGenerate: () => void;
  onPreview?: () => void;
}) {
  const hasVideo = Boolean(videoUrl);

  return (
    <article
      className="flex w-full flex-col"
      style={{ gap: STORY_VIDEO_SLOT.labelThumbGap }}
    >
      <header
        className="flex items-center justify-between gap-2"
        style={{ height: STORY_VIDEO_SLOT.labelHeight }}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-white/45">
          <Film className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          <span className="font-medium tracking-wide">Video</span>
        </div>
        <span className="text-[10px] text-white/25">镜 {frameIndex}</span>
      </header>

      <div
        className={cn(
          "group relative w-full shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]",
          generating && "canvas-story-media-generating",
        )}
        style={{ height: STORY_VIDEO_SLOT.thumbHeight }}
      >
        {hasVideo ? (
          <video
            src={videoUrl}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
            preload="metadata"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-black/40" />
        )}

        {!hasVideo && !generating ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-white/20">
            待生成
          </span>
        ) : null}

        {generating ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
            <RefreshCw className="size-8 animate-spin text-white/70" />
          </div>
        ) : null}

        {hasVideo && !generating && onPreview ? (
          <button
            type="button"
            title="播放"
            className="nodrag absolute inset-0 z-10 flex items-center justify-center"
            onClick={onPreview}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-white/25 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105">
              <Play className="ml-0.5 size-5 fill-white text-white" />
            </span>
          </button>
        ) : null}

        {hasVideo && !generating ? (
          <button
            type="button"
            title={generateTitle}
            className="nodrag absolute right-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white/80 opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/75 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onGenerate();
            }}
          >
            <RefreshCw className="size-3.5" />
          </button>
        ) : null}
      </div>
    </article>
  );
}
