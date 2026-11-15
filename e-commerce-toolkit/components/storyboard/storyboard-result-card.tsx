"use client";

import { Clapperboard, Film, Loader2 } from "lucide-react";

import { EcomDeliverableVideoPreview } from "@/components/media/ecom-deliverable-video-preview";
import { isStoryboardVideoUrl } from "@/lib/storyboard-media";

type Props = {
  label: string;
  emptyHint: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  videoSrc?: string | null;
  busy?: boolean;
  disabled?: boolean;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  mergeBusy?: boolean;
  canMerge?: boolean;
  onMergePanels?: () => void;
  /** 与左侧完整分镜图同高（路径 B 分镜图就绪、待成片） */
  matchSheetPreview?: boolean;
  onPreviewVideo?: () => void;
};

/** 完整成片预览卡（无「刷新」误触重新生成） */
export function StoryboardResultCard({
  label,
  emptyHint,
  aspectRatio = "9:16",
  videoSrc,
  busy,
  disabled,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  mergeBusy,
  canMerge,
  onMergePanels,
  onPreviewVideo,
  matchSheetPreview = false,
}: Props) {
  const hasVideo = isStoryboardVideoUrl(videoSrc);

  const emptyActions = (
    <>
      {primaryActionLabel && onPrimaryAction ? (
        <button
          type="button"
          disabled={disabled || busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          onClick={onPrimaryAction}
        >
          <Film className="h-3.5 w-3.5" />
          {primaryActionLabel}
        </button>
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <button
          type="button"
          disabled={disabled || mergeBusy || !canMerge}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          onClick={onSecondaryAction}
        >
          {mergeBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clapperboard className="h-3.5 w-3.5" />
          )}
          {secondaryActionLabel}
        </button>
      ) : null}
    </>
  );

  return (
    <div className="isolate flex h-full min-w-0 flex-col">
      <p className="mb-2 text-sm font-bold text-[#1d1d1f]">{label}</p>
      <EcomDeliverableVideoPreview
        aspectRatio={aspectRatio}
        videoSrc={videoSrc}
        busy={busy}
        matchPreviewFrame={matchSheetPreview}
        emptyHint={!hasVideo && !busy ? emptyHint : undefined}
        emptyActions={!hasVideo && !busy ? emptyActions : undefined}
        onPreview={hasVideo && onPreviewVideo ? onPreviewVideo : undefined}
      />
      {onMergePanels && canMerge ? (
        <button
          type="button"
          disabled={mergeBusy || busy}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          onClick={onMergePanels}
        >
          {mergeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
          合并分镜视频
        </button>
      ) : null}
    </div>
  );
}