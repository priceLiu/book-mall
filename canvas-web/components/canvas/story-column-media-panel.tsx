"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Clapperboard, Eye, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORY_MEDIA_COL_WIDTH } from "@/lib/canvas/story-ref-image";

const REFRESH_BTN =
  "nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/45 bg-[#fb923c]/20 text-[#fdba74] hover:bg-[#fb923c]/30";

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
}) {
  const hasVisual = Boolean(imageUrl || videoUrl);
  const showPreview = Boolean(onPreview && hasVisual && !previewDisabled);
  const isFrame = mediaMode === "frame";
  const hasFrameImage = Boolean(imageUrl);
  const btnDisabled = Boolean(generateDisabled || generating);

  return (
    <div
      className="flex shrink-0 flex-col gap-1 self-start"
      style={{ width: STORY_MEDIA_COL_WIDTH, minHeight: "var(--row-media-min, 148px)" }}
    >
      <div
        className={cn(
          "group relative min-h-[var(--row-media-min,148px)] flex-1 overflow-hidden rounded-md border border-white/10 bg-black/45",
          generating && "canvas-story-media-generating border-[#fb923c]/50",
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-contain"
            unoptimized
          />
        ) : null}
        {videoUrl && !imageUrl ? (
          <video
            src={videoUrl}
            className="absolute inset-0 h-full w-full object-contain"
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
            "absolute inset-0 flex items-center justify-center gap-2 transition-opacity",
            hasVisual && !(isFrame && hasFrameImage)
              ? "opacity-0 group-hover:opacity-100 group-hover:bg-black/45"
              : isFrame && hasFrameImage
                ? "opacity-0 group-hover:opacity-100 group-hover:bg-black/45"
                : "opacity-100",
          )}
        >
          {generating ? (
            <div className="relative z-10 flex flex-col items-center gap-1">
              <RefreshCw className="size-6 animate-spin text-[#fdba74]" />
            </div>
          ) : isFrame && hasFrameImage ? (
            <>
              {showPreview ? (
                <button
                  type="button"
                  aria-label="预览分镜图"
                  className="nodrag inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/75"
                  onClick={onPreview}
                >
                  <Eye className="size-4" />
                </button>
              ) : null}
              {onGenerateVideo ? (
                <button
                  type="button"
                  aria-label="生成分镜视频"
                  className="nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/40 bg-black/55 text-[#fdba74] shadow-lg backdrop-blur-sm hover:bg-black/75"
                  onClick={onGenerateVideo}
                >
                  <Clapperboard className="size-4" />
                </button>
              ) : null}
            </>
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
      {audioUrl ? (
        <audio src={audioUrl} controls className="nodrag h-7 w-full shrink-0" />
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
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <p className="text-sm text-white/80">{title ?? "预览"}</p>
        <button
          type="button"
          className="rounded p-1 text-white/70 hover:bg-white/10"
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "video" ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
