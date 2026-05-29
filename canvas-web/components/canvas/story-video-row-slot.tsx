"use client";

import { Download, Film, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORY_VIDEO_SLOT } from "@/lib/canvas/story-column-layout";
import {
  storyEditionCornerRegenBtnClass,
  storyEditionGeneratingBorderClass,
  storyEditionIconBtnClass,
  storyEditionSpinClass,
  type StoryEdition,
} from "@/lib/canvas/story-edition-chrome";
import { Lock } from "lucide-react";
import { StoryErrorLine } from "@/components/canvas/story-status-line";
import { STORY_HINT_GOLD_CLASS } from "@/lib/canvas/story-column-sync";
import { StoryVideoPromptPopover } from "./story-video-prompt-popover";
import { SaveVideoToLibraryButton } from "@/components/canvas/save-video-to-library-button";
import type { SaveVideoToLibraryInput } from "@/lib/canvas-video-library";

const SLOT_CORNER_BTN =
  "nodrag absolute z-20 inline-flex size-8 items-center justify-center rounded-full border shadow-md backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100";

const SLOT_DOWNLOAD_BTN =
  "nodrag absolute z-20 inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90 hover:scale-105";

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
  edition = "comic",
  videoBlockReason,
  saveToLibrary,
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
  edition?: StoryEdition;
  /** 静帧/过审未满足时的提示 */
  videoBlockReason?: string | null;
  saveToLibrary?: Omit<SaveVideoToLibraryInput, "sourceUrl"> | null;
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
            generating && storyEditionGeneratingBorderClass(edition),
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
              <RefreshCw className={storyEditionSpinClass(edition, "lg")} />
            </div>
          ) : !hasVideo ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-2">
              {videoBlockReason ? (
                <>
                  <Lock className={`size-4 ${STORY_HINT_GOLD_CLASS}`} />
                  <p className={`text-center text-[9px] leading-snug ${STORY_HINT_GOLD_CLASS}`}>
                    {videoBlockReason}
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  aria-label="生成分镜视频"
                  className={storyEditionIconBtnClass(edition)}
                  onClick={onGenerate}
                >
                  <RefreshCw className="size-4" />
                </button>
              )}
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

          {hasVideo && !generating && saveToLibrary ? (
            <SaveVideoToLibraryButton
              videoUrl={videoUrl}
              saveInput={saveToLibrary}
            />
          ) : null}

          {hasVideo && !generating ? (
            <a
              href={videoUrl}
              download={`story-video-${frameIndex}.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="下载视频"
              title="下载 mp4"
              className={cn(SLOT_DOWNLOAD_BTN, "right-2.5 bottom-2.5")}
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="size-5 pointer-events-none" />
            </a>
          ) : null}

          {hasVideo && !generating ? (
            <button
              type="button"
              aria-label="重新生成视频"
              className={cn(
                SLOT_CORNER_BTN,
                storyEditionCornerRegenBtnClass(edition),
              )}
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
        <StoryErrorLine message={errorMessage} />
      ) : null}
    </article>
  );
}
