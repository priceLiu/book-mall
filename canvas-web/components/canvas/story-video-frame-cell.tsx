"use client";

import {
  STORY_VIDEO_INTRA_ROW_GAP,
  storyMediaAlignedRowHeight,
} from "@/lib/canvas/story-column-layout";
import { StoryTtsRowSlot } from "./story-tts-row-slot";
import { StoryVideoRowSlot } from "./story-video-row-slot";
import type { StoryEdition } from "@/lib/canvas/story-edition-chrome";
import type { SaveVideoToLibraryInput } from "@/lib/canvas-video-library-types";

/** 单列单镜：上视频卡 + 下 TTS */
export function StoryVideoFrameCell({
  edition,
  frameIndex,
  videoUrl,
  videoPrompt,
  videoRefLabels,
  videoGenerating,
  videoError,
  videoBlockReason,
  onGenerateVideo,
  onPreviewVideo,
  saveToLibrary,
  audioUrl,
  dialoguePreview,
  ttsGenerating,
  ttsError,
  ttsBlockReason,
  onGenerateTts,
  onPreviewTts,
}: {
  edition: StoryEdition;
  frameIndex: number;
  videoUrl?: string;
  videoPrompt?: string;
  videoRefLabels?: string[];
  videoGenerating?: boolean;
  videoError?: string;
  videoBlockReason?: string | null;
  onGenerateVideo: () => void;
  onPreviewVideo?: () => void;
  saveToLibrary?: Omit<SaveVideoToLibraryInput, "sourceUrl"> | null;
  audioUrl?: string;
  dialoguePreview?: string;
  ttsGenerating?: boolean;
  ttsError?: string;
  ttsBlockReason?: string | null;
  onGenerateTts: () => void;
  onPreviewTts?: () => void;
}) {
  const rowH = storyMediaAlignedRowHeight({ pro: edition === "pro" });

  return (
    <div
      className="box-border flex w-full shrink-0 flex-col overflow-hidden"
      style={{
        height: rowH,
        minHeight: rowH,
        gap: STORY_VIDEO_INTRA_ROW_GAP,
      }}
    >
      <StoryVideoRowSlot
        edition={edition}
        frameIndex={frameIndex}
        videoUrl={videoUrl}
        videoPrompt={videoPrompt}
        videoRefLabels={videoRefLabels}
        generating={videoGenerating}
        errorMessage={videoError}
        videoBlockReason={videoBlockReason}
        onGenerate={onGenerateVideo}
        onPreview={onPreviewVideo}
        saveToLibrary={saveToLibrary}
      />
      <StoryTtsRowSlot
        edition={edition}
        frameIndex={frameIndex}
        audioUrl={audioUrl}
        dialoguePreview={dialoguePreview}
        generating={ttsGenerating}
        errorMessage={ttsError}
        blockReason={ttsBlockReason}
        onGenerate={onGenerateTts}
        onPreview={onPreviewTts}
      />
    </div>
  );
}
