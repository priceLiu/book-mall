"use client";

import { Film, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORY_VIDEO_SLOT } from "@/lib/canvas/story-column-layout";
import { StoryVideoPromptPopover } from "./story-video-prompt-popover";

const REFRESH_BTN =
  "nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/45 bg-[#fb923c]/20 text-[#fdba74] hover:bg-[#fb923c]/30";

/** 分镜视频列 · 纵向成片（手动点击生成，无文案 overlay） */
export function StoryVideoRowSlot({
  frameIndex,
  videoUrl,
  videoPrompt,
  videoRefLabels = [],
  generating,
  errorMessage,
  onGenerate,
  onPreview,
}: {
  frameIndex: number;
  videoUrl?: string;
  /** hover 时在视频右侧展示完整视频提示词 */
  videoPrompt?: string;
  videoRefLabels?: string[];
  generating?: boolean;
  errorMessage?: string;
  onGenerate: () => void;
  onPreview?: () => void;
}) {
  const hasVideo = Boolean(videoUrl);
  const promptText = (videoPrompt ?? "").trim();

  return (
    <article
      className="group/slot relative flex w-full flex-col"
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

      <div className="relative">
        <div
          className={cn(
            "group relative w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a]",
            generating && "canvas-story-media-generating border-[#fb923c]/50",
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

          {generating ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
              <RefreshCw className="size-8 animate-spin text-[#fdba74]" />
            </div>
          ) : !hasVideo ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <button
                type="button"
                aria-label="生成分镜视频"
                className={REFRESH_BTN}
                onClick={onGenerate}
              >
                <RefreshCw className="size-4" />
              </button>
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

          {hasVideo && !generating ? (
            <button
              type="button"
              aria-label="重新生成视频"
              className="nodrag absolute right-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-full border border-[#fb923c]/40 bg-black/55 text-[#fdba74] opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/75"
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
            >
              <RefreshCw className="size-3.5" />
            </button>
          ) : null}
        </div>

        {promptText ? (
          <StoryVideoPromptPopover
            prompt={promptText}
            refLabels={videoRefLabels}
          />
        ) : null}
      </div>
      {errorMessage && !generating ? (
        <p className="text-[10px] leading-snug text-red-400/90">{errorMessage}</p>
      ) : null}
    </article>
  );
}
