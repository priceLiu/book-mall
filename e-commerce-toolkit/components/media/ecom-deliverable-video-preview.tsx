"use client";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomVideoStagePreview } from "@/components/media/ecom-video-stage-preview";
import { STORYBOARD_PREVIEW_MIN_H, storyboardPreviewAspectClass } from "@/lib/storyboard-aspect";
import { isStoryboardVideoUrl } from "@/lib/storyboard-media";
import { cn } from "@/lib/utils";

export type EcomDeliverableVideoAspect = "16:9" | "9:16" | "1:1";

type Props = {
  aspectRatio?: EcomDeliverableVideoAspect;
  videoSrc?: string | null;
  busy?: boolean;
  generatingLabel?: string;
  emptyHint?: string;
  matchPreviewFrame?: boolean;
  onPreview?: () => void;
  emptyActions?: React.ReactNode;
  className?: string;
  frameClassName?: string;
};

/**
 * 单条最终成片预览 Stage（T2v · 与故事版 `StoryboardResultCard` 内框一致）
 */
export function EcomDeliverableVideoPreview({
  aspectRatio = "9:16",
  videoSrc,
  busy,
  generatingLabel = "成片生成中…",
  emptyHint,
  matchPreviewFrame = false,
  onPreview,
  emptyActions,
  className,
  frameClassName,
}: Props) {
  const hasVideo = isStoryboardVideoUrl(videoSrc);
  const usePreviewFrame = hasVideo || busy || matchPreviewFrame;

  return (
    <div
      className={cn(
        "relative isolate w-full overflow-hidden rounded-xl border border-[var(--ecom-divider)]",
        STORYBOARD_PREVIEW_MIN_H,
        usePreviewFrame
          ? cn(
              storyboardPreviewAspectClass(aspectRatio),
              hasVideo || busy ? "bg-black" : "bg-[var(--ecom-parchment)]",
            )
          : "bg-[var(--ecom-parchment)]",
        frameClassName,
        className,
      )}
    >
      {busy ? (
        <EcomMediaGeneratingBusy background="black" label={generatingLabel} />
      ) : hasVideo && onPreview ? (
        <EcomVideoStagePreview
          src={videoSrc!}
          onPreview={onPreview}
          className="absolute inset-0"
        />
      ) : (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-3 text-center">
          {emptyHint ? (
            <p className="text-xs text-[var(--ecom-subtle)]">{emptyHint}</p>
          ) : null}
          {emptyActions}
        </div>
      )}
    </div>
  );
}