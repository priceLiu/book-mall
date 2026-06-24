"use client";

import type { ReactNode } from "react";
import { Download, Play, RefreshCw } from "lucide-react";

import { SaveVideoToLibraryButton } from "@/components/canvas/save-video-to-library-button";
import { LazyViewportImage, LazyViewportVideo } from "@/components/canvas/lazy-viewport-media";
import type { SaveVideoToLibraryInput } from "@/lib/canvas-video-library-types";
import { cn } from "@/lib/utils";

const SLOT_DOWNLOAD_BTN =
  "nodrag absolute z-20 inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90 hover:scale-105";

/** 与分镜视频列 StoryVideoRowSlot 一致：默认封面图，点击播放再加载 mp4 */
export function CanvasVideoPreviewSlot({
  videoUrl,
  posterUrl,
  generating,
  onPreview,
  downloadHref,
  downloadFileName,
  generatingLabel,
  className,
  emptyIcon,
  emptyMessage,
  saveToLibrary,
}: {
  videoUrl?: string;
  posterUrl?: string;
  generating?: boolean;
  onPreview?: () => void;
  downloadHref?: string;
  downloadFileName?: string;
  generatingLabel?: string;
  className?: string;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
  saveToLibrary?: Omit<SaveVideoToLibraryInput, "sourceUrl"> | null;
}) {
  const hasVideo = Boolean(videoUrl);
  const displayPoster = posterUrl?.trim();

  return (
    <div
      className={cn(
        "group relative min-h-0 w-full overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a]",
        generating && "canvas-story-media-generating border-[#fb923c]/50",
        className,
      )}
    >
      {hasVideo ? (
        displayPoster ? (
          <LazyViewportImage
            src={displayPoster}
            alt=""
            className="absolute inset-0"
            imgClassName="object-cover object-center"
            rootMargin="200px"
          />
        ) : (
          <LazyViewportVideo
            src={videoUrl}
            className="absolute inset-0"
            videoClassName="object-cover object-center"
            rootMargin="200px"
          />
        )
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
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/50">
          <RefreshCw className="size-8 animate-spin text-[#fdba74]" />
          {generatingLabel?.trim() ? (
            <span className="text-[11px] font-medium text-[#fdba74]">
              {generatingLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {hasVideo && !generating && saveToLibrary ? (
        <SaveVideoToLibraryButton
          videoUrl={videoUrl}
          saveInput={saveToLibrary}
        />
      ) : null}

      {hasVideo && !generating && downloadHref ? (
        <a
          href={downloadHref}
          download={downloadFileName}
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
