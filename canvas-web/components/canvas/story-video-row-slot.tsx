"use client";

import { useRef } from "react";
import { Download, Play, RefreshCw } from "lucide-react";
import { LazyViewportVideo } from "@/components/canvas/lazy-viewport-media";
import { cn } from "@/lib/utils";
import { STORY_VIDEO_SLOT } from "@/lib/canvas/story-column-layout";
import {
  STYLE_LIBRARY_CARD_SHELL,
  STYLE_LIBRARY_MEDIA_FRAME,
} from "@/lib/canvas/style-library-card-chrome";
import {
  StoryVideoPromptTipPortal,
  useStoryVideoPromptTip,
} from "@/components/canvas/story-video-prompt-popover";
import { StoryRowTitleBadge } from "@/components/canvas/story-row-prompt-field";
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
import { SaveVideoToLibraryButton } from "@/components/canvas/save-video-to-library-button";
import type { SaveVideoToLibraryInput } from "@/lib/canvas-video-library-types";

const SLOT_CORNER_BTN =
  "nodrag absolute z-20 inline-flex size-8 items-center justify-center rounded-full border shadow-md opacity-0 transition-opacity group-hover/card:opacity-100";

const SLOT_DOWNLOAD_BTN =
  "nodrag absolute z-20 inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/80 text-white shadow-lg transition hover:bg-black/90 hover:scale-105";

/** 分镜视频列 · 单行卡片（悬停右侧 Tip 看全文，卡片内仅缩略 + 中央生成钮） */
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
  videoPrompt?: string;
  videoRefLabels?: string[];
  generating?: boolean;
  errorMessage?: string;
  onGenerate: () => void;
  onPreview?: () => void;
  edition?: StoryEdition;
  videoBlockReason?: string | null;
  saveToLibrary?: Omit<SaveVideoToLibraryInput, "sourceUrl"> | null;
}) {
  const hasVideo = Boolean(videoUrl);
  const promptText = (videoPrompt ?? "").trim();
  const anchorRef = useRef<HTMLDivElement>(null);
  const tip = useStoryVideoPromptTip(anchorRef);

  const onThumbEnter = () => {
    if (!promptText || generating) return;
    tip.showTip();
  };

  return (
    <article
      className={cn(
        STYLE_LIBRARY_CARD_SHELL,
        "group/slot nodrag w-full !overflow-visible",
      )}
    >
      <div
        ref={anchorRef}
        className="pointer-events-auto relative !overflow-visible"
        onPointerEnter={onThumbEnter}
        onPointerLeave={tip.scheduleHide}
      >
        <div
          className={cn(
            STYLE_LIBRARY_MEDIA_FRAME,
            "overflow-hidden",
            generating && storyEditionGeneratingBorderClass(edition),
          )}
          style={{ height: STORY_VIDEO_SLOT.thumbHeight }}
        >
          <StoryRowTitleBadge
            title={`镜 ${frameIndex}`}
            placement="media-inset"
          />

          {hasVideo ? (
            <LazyViewportVideo
              src={videoUrl}
              className="absolute inset-0"
              videoClassName="object-cover"
              rootMargin="160px"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-black/40" />
          )}

          {generating ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
              <RefreshCw className={storyEditionSpinClass(edition, "lg")} />
            </div>
          ) : !hasVideo ? (
            <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 px-2">
              {videoBlockReason ? (
                <>
                  <Lock className={`size-4 ${STORY_HINT_GOLD_CLASS}`} />
                  <p
                    className={`text-center text-[9px] leading-snug ${STORY_HINT_GOLD_CLASS}`}
                  >
                    {videoBlockReason}
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  aria-label="生成分镜视频"
                  className={cn(storyEditionIconBtnClass(edition), "relative z-40")}
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
              <span className="flex size-12 items-center justify-center rounded-full bg-white/30 shadow-lg transition-transform group-hover/card:scale-105">
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
                "right-2.5 top-2.5",
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
      </div>

      <StoryVideoPromptTipPortal
        open={tip.open}
        pos={tip.pos}
        prompt={promptText}
        refLabels={videoRefLabels}
        edition={edition}
        onEnter={() => {
          tip.clearHideTimer();
          tip.showTip();
        }}
        onLeave={tip.scheduleHide}
      />

      {errorMessage && !generating ? (
        <StoryErrorLine message={errorMessage} className="px-3 pb-2" />
      ) : null}
    </article>
  );
}
