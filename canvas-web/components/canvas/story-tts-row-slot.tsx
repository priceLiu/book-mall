"use client";

import { Download, Mic, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORY_TTS_SLOT } from "@/lib/canvas/story-column-layout";
import {
  storyEditionCornerRegenBtnClass,
  storyEditionGeneratingBorderClass,
  storyEditionIconBtnClass,
  storyEditionSpinClass,
  type StoryEdition,
} from "@/lib/canvas/story-edition-chrome";
import { StoryErrorLine } from "@/components/canvas/story-status-line";
import { STORY_HINT_GOLD_CLASS } from "@/lib/canvas/story-column-sync";

const SLOT_CORNER_BTN =
  "nodrag absolute z-20 inline-flex size-7 items-center justify-center rounded-full border shadow-md backdrop-blur-sm opacity-0 transition-opacity group-hover/tts:opacity-100";

/** 分镜视频列 · 每镜 TTS 配音轨（剪映导出 audio/） */
export function StoryTtsRowSlot({
  frameIndex,
  audioUrl,
  dialoguePreview,
  generating,
  errorMessage,
  blockReason,
  onGenerate,
  onPreview,
  edition = "comic",
}: {
  frameIndex: number;
  audioUrl?: string;
  dialoguePreview?: string;
  generating?: boolean;
  errorMessage?: string;
  blockReason?: string | null;
  onGenerate: () => void;
  onPreview?: () => void;
  edition?: StoryEdition;
}) {
  const hasAudio = Boolean(audioUrl);
  const dialogue = (dialoguePreview ?? "").trim();

  return (
    <article
      className="group/tts relative flex w-full flex-col"
      style={{ gap: STORY_TTS_SLOT.labelThumbGap }}
    >
      <header
        className="flex items-center justify-between gap-2"
        style={{ height: STORY_TTS_SLOT.labelHeight }}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-white/45">
          <Mic className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          <span className="font-medium tracking-wide">TTS</span>
        </div>
        <span className="text-[10px] text-white/25">镜 {frameIndex}</span>
      </header>

      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#141414]",
          generating && storyEditionGeneratingBorderClass(edition),
        )}
        style={{ height: STORY_TTS_SLOT.thumbHeight }}
      >
        {hasAudio ? (
          <audio
            src={audioUrl}
            className="hidden"
            preload="metadata"
          />
        ) : null}

        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-2 py-1.5">
          <p
            className="min-w-0 flex-1 truncate text-[10px] text-white/55"
            title={dialogue || undefined}
          >
            {dialogue || "（无对白）"}
          </p>
        </div>

        {generating ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
            <RefreshCw className={storyEditionSpinClass(edition, "sm")} />
          </div>
        ) : !hasAudio ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            {blockReason ? (
              <p
                className={`max-w-[90%] text-center text-[9px] leading-snug ${STORY_HINT_GOLD_CLASS}`}
              >
                {blockReason}
              </p>
            ) : (
              <button
                type="button"
                aria-label="生成分镜配音"
                className={storyEditionIconBtnClass(edition)}
                onClick={onGenerate}
              >
                <Mic className="size-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2">
            {onPreview ? (
              <button
                type="button"
                aria-label="播放配音"
                className="nodrag inline-flex size-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
                onClick={onPreview}
              >
                <Play className="ml-0.5 size-4 fill-white text-white" />
              </button>
            ) : null}
            <a
              href={audioUrl}
              download={`story-tts-${frameIndex}.mp3`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="下载配音"
              className="nodrag inline-flex size-8 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="size-3.5 pointer-events-none" />
            </a>
            <button
              type="button"
              aria-label="重新生成配音"
              className={cn(
                SLOT_CORNER_BTN,
                "relative opacity-100",
                storyEditionCornerRegenBtnClass(edition),
              )}
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
            >
              <RefreshCw className="size-3" />
            </button>
          </div>
        )}
      </div>

      {errorMessage && !generating ? (
        <StoryErrorLine message={errorMessage} />
      ) : null}
    </article>
  );
}
