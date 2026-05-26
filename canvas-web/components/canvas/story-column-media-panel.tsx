"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Clapperboard, Download, Eye, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORY_MEDIA_COL_WIDTH } from "@/lib/canvas/story-ref-image";
import { CanvasVideoPlayer } from "./canvas-video-player";
import { StoryVideoPromptPopover } from "./story-video-prompt-popover";

const REFRESH_BTN =
  "nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/45 bg-[#fb923c]/20 text-[#fdba74] hover:bg-[#fb923c]/30";

function blockCanvasPointer(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation();
  e.preventDefault();
}

/** 第 3 列：输出图/视频；中央生成，有图时叠放生成与预览图标 */
export function StoryColumnMediaPanel({
  imageUrl,
  videoUrl,
  audioUrl,
  generating,
  generateDisabled,
  mediaMode = "character",
  onGenerate,
  onGenerateVideo,
  onPreview,
  previewDisabled,
  errorMessage,
  videoPrompt,
  videoRefLabels,
}: {
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  generating?: boolean;
  generateDisabled?: boolean;
  /** 分镜脚本列：空态生分镜图，有图时 hover 预览 + 生成视频 */
  mediaMode?: "character" | "frame";
  onGenerate: () => void;
  onGenerateVideo?: () => void;
  onPreview?: () => void;
  previewDisabled?: boolean;
  errorMessage?: string;
  /** 分镜列：hover 分镜图时展示将传给视频模型的完整提示词 */
  videoPrompt?: string;
  videoRefLabels?: string[];
}) {
  const hasVisual = Boolean(imageUrl || videoUrl);
  const showPreview = Boolean(onPreview && hasVisual && !previewDisabled);
  const isFrame = mediaMode === "frame";
  const hasFrameImage = Boolean(imageUrl);
  const btnDisabled = Boolean(generateDisabled || generating);

  return (
    <div
      className="flex shrink-0 flex-col gap-1 self-start"
      style={{ width: STORY_MEDIA_COL_WIDTH, minHeight: "var(--row-media-min, 248px)" }}
    >
      <div
        className={cn(
          "group/frame-prompt relative min-h-[var(--row-media-min,248px)] flex-1 overflow-visible rounded-md border border-white/10 bg-black/45",
          generating && "canvas-story-media-generating border-[#fb923c]/50",
        )}
      >
        <div className="absolute inset-0 overflow-hidden rounded-md">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            className="pointer-events-none object-contain"
            unoptimized
          />
        ) : null}
        {isFrame && hasFrameImage && onGenerateVideo && !generating ? (
          <button
            type="button"
            aria-label="生成分镜视频"
            title="生成分镜视频"
            className="nodrag pointer-events-auto absolute bottom-1.5 right-1.5 z-20 inline-flex size-8 items-center justify-center rounded-full border border-[#fb923c]/50 bg-black/70 text-[#fdba74] shadow-lg backdrop-blur-sm hover:bg-black/85"
            onPointerDown={(e) => {
              blockCanvasPointer(e);
              onGenerateVideo();
            }}
          >
            <Clapperboard className="size-4 pointer-events-none" />
          </button>
        ) : null}
        {videoUrl && !imageUrl ? (
          <video
            src={videoUrl}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            playsInline
            muted
          />
        ) : null}
        {!hasVisual ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] text-white/25">
            —
          </span>
        ) : null}
        <div
          className={cn(
            "absolute inset-0 z-10 flex items-center justify-center gap-2 transition-opacity",
            generating
              ? "pointer-events-auto opacity-100 bg-black/45"
              : hasVisual && !(isFrame && hasFrameImage)
                ? "pointer-events-none opacity-0 group-hover/frame-prompt:pointer-events-auto group-hover/frame-prompt:opacity-100 group-hover/frame-prompt:bg-black/45"
                : isFrame && hasFrameImage
                  ? "pointer-events-none opacity-0 group-hover/frame-prompt:pointer-events-auto group-hover/frame-prompt:opacity-100 group-hover/frame-prompt:bg-black/45"
                  : "pointer-events-auto opacity-100",
          )}
        >
          {generating ? (
            <div className="relative z-10 flex flex-col items-center gap-1">
              <RefreshCw className="size-6 animate-spin text-[#fdba74]" />
            </div>
          ) : isFrame && hasFrameImage ? (
            showPreview ? (
              <button
                type="button"
                aria-label="预览分镜图"
                className="nodrag inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/75"
                onPointerDown={blockCanvasPointer}
                onMouseDown={blockCanvasPointer}
                onClick={(e) => {
                  blockCanvasPointer(e);
                  onPreview?.();
                }}
              >
                <Eye className="size-4 pointer-events-none" />
              </button>
            ) : null
          ) : hasVisual ? (
            <>
              <button
                type="button"
                aria-label="重新生成"
                className="nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/40 bg-black/55 text-[#fdba74] shadow-lg backdrop-blur-sm hover:bg-black/75"
                onClick={onGenerate}
              >
                <RefreshCw className="size-4" />
              </button>
              {showPreview ? (
                <button
                  type="button"
                  aria-label="预览"
                  className="nodrag inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/75"
                  onClick={onPreview}
                >
                  <Eye className="size-4" />
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              disabled={btnDisabled}
              aria-label={isFrame ? "生成分镜图" : "生成"}
              title={generateDisabled ? "请先在上方选择分镜图 IMAGE 模型" : undefined}
              className={cn(
                REFRESH_BTN,
                generateDisabled && "cursor-not-allowed opacity-40",
              )}
              onClick={onGenerate}
            >
              <RefreshCw className="size-4" />
            </button>
          )}
        </div>
        </div>
        {isFrame && hasFrameImage && videoPrompt?.trim() ? (
          <StoryVideoPromptPopover
            prompt={videoPrompt}
            refLabels={videoRefLabels}
            groupHoverClass="group-hover/frame-prompt:block"
          />
        ) : null}
      </div>
      {audioUrl ? (
        <audio src={audioUrl} controls className="nodrag h-7 w-full shrink-0" />
      ) : null}
      {errorMessage && !generating ? (
        <p className="text-[10px] leading-snug text-red-400/90">{errorMessage}</p>
      ) : null}
    </div>
  );
}

/** 单图/单视频全屏预览（角色列等无对比参考时） */
export function StoryMediaPreviewModal({
  url,
  kind = "image",
  title,
  onClose,
}: {
  url: string;
  kind?: "image" | "video";
  title?: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex flex-col bg-black/92 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-white/80">{title ?? "预览"}</p>
        <div className="flex items-center gap-2">
          {kind === "video" ? (
            <a
              href={url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="nodrag inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1 text-[12px] text-white/85 hover:bg-white/10"
            >
              <Download className="size-3.5" />
              下载 mp4
            </a>
          ) : null}
          <button
            type="button"
            className="rounded p-1 text-white/70 hover:bg-white/10"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div onClick={(e) => e.stopPropagation()} className="max-w-full">
          {kind === "video" ? (
            <CanvasVideoPlayer
              src={url}
              autoPlay
              persistentControls
              className="max-h-[calc(100dvh-88px)] w-[min(96vw,960px)]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className="max-h-[calc(100dvh-88px)] max-w-[min(96vw,960px)] object-contain"
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
