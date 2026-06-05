"use client";

import { Clapperboard, Eye, Film, Loader2 } from "lucide-react";

import { STORYBOARD_PREVIEW_MIN_H, storyboardPreviewAspectClass } from "@/lib/storyboard-aspect";
import { isStoryboardVideoUrl } from "@/lib/storyboard-media";
import { cn } from "@/lib/utils";

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
}: Props) {
  const hasVideo = isStoryboardVideoUrl(videoSrc);

  return (
    <div className="isolate flex min-w-0 flex-col">
      <p className="mb-2 text-sm font-bold text-[#1d1d1f]">{label}</p>
      <div
        className={cn(
          "relative isolate w-full overflow-hidden rounded-xl border border-[#e8e8ed]",
          STORYBOARD_PREVIEW_MIN_H,
          hasVideo || busy
            ? cn(storyboardPreviewAspectClass(aspectRatio), "bg-black")
            : "bg-[#f5f5f7]",
        )}
      >
        {busy ? (
          <div className="flex h-full min-h-[200px] items-center justify-center gap-2 text-sm text-[#6e6e73]">
            <Loader2 className="h-5 w-5 animate-spin" />
            成片生成中…
          </div>
        ) : hasVideo ? (
          <>
            <video
              key={videoSrc}
              src={videoSrc!}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 z-0 h-full w-full object-contain"
            />
            {onPreviewVideo ? (
              <div className="absolute right-2 top-2 z-10">
                <button
                  type="button"
                  title="全屏预览"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow"
                  onClick={onPreviewVideo}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-3 text-center">
            <p className="text-xs text-[#86868b]">{emptyHint}</p>
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
          </div>
        )}
      </div>
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
