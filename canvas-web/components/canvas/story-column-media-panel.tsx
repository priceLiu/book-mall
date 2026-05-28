"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Clapperboard, Check, Download, Eye, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORY_MEDIA_COL_WIDTH } from "@/lib/canvas/story-ref-image";
import { CanvasVideoPlayer } from "./canvas-video-player";
import {
  storyEditionGeneratingBorderClass,
  storyEditionIconBtnClass,
  storyEditionOverlayIconBtnClass,
  storyEditionSpinClass,
  storyEditionVideoOverlayBtnClass,
  type StoryEdition,
} from "@/lib/canvas/story-edition-chrome";
import { StoryErrorLine } from "@/components/canvas/story-status-line";
import { STORY_HINT_GOLD_CLASS } from "@/lib/canvas/story-column-sync";
import { StoryVideoPromptPopover } from "./story-video-prompt-popover";

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
  edition = "comic",
  frameApproved,
  frameRejectedReason,
  videoBlockReason,
  onApproveFrame,
  onRejectFrame,
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
  edition?: StoryEdition;
  frameApproved?: boolean;
  frameRejectedReason?: string;
  videoBlockReason?: string | null;
  onApproveFrame?: () => void;
  onRejectFrame?: () => void;
}) {
  const hasVisual = Boolean(imageUrl || videoUrl);
  const showPreview = Boolean(onPreview && hasVisual && !previewDisabled);
  const isFrame = mediaMode === "frame";
  const hasFrameImage = Boolean(imageUrl);
  const btnDisabled = Boolean(generateDisabled || generating);
  const canGenerateVideo =
    Boolean(onGenerateVideo) &&
    hasFrameImage &&
    frameApproved &&
    !videoBlockReason &&
    !generating;

  return (
    <div
      className="flex shrink-0 flex-col gap-1 self-start"
      style={{ width: STORY_MEDIA_COL_WIDTH, minHeight: "var(--row-media-min, 248px)" }}
    >
      <div
        className={cn(
          "group/frame-prompt relative min-h-[var(--row-media-min,248px)] flex-1 overflow-visible rounded-md border border-white/10 bg-black/45",
          generating && storyEditionGeneratingBorderClass(edition),
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
        {isFrame && hasFrameImage && canGenerateVideo ? (
          <button
            type="button"
            aria-label="生成分镜视频"
            title="生成分镜视频（图生视频 · 首帧锁定）"
            className={storyEditionVideoOverlayBtnClass(edition)}
            onPointerDown={(e) => {
              blockCanvasPointer(e);
              onGenerateVideo?.();
            }}
          >
            <Clapperboard className="size-4 pointer-events-none" />
          </button>
        ) : null}
        {isFrame && hasFrameImage && !frameApproved && !generating ? (
          <div className="pointer-events-auto absolute bottom-1.5 left-1.5 z-20 flex gap-1">
            {onApproveFrame ? (
              <button
                type="button"
                className="nodrag rounded border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-500/30"
                onClick={(e) => {
                  e.stopPropagation();
                  onApproveFrame();
                }}
              >
                <Check className="mr-0.5 inline size-3" />
                通过
              </button>
            ) : null}
            {onRejectFrame ? (
              <button
                type="button"
                className="nodrag rounded border border-red-400/30 bg-red-500/15 px-1.5 py-0.5 text-[9px] text-red-200 hover:bg-red-500/25"
                onClick={(e) => {
                  e.stopPropagation();
                  onRejectFrame();
                }}
              >
                驳回
              </button>
            ) : null}
          </div>
        ) : null}
        {isFrame && hasFrameImage && frameApproved ? (
          <span className="pointer-events-none absolute left-1.5 top-1.5 z-20 rounded border border-emerald-400/35 bg-emerald-950/70 px-1.5 py-0.5 text-[9px] text-emerald-200">
            已过审
          </span>
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
              <RefreshCw className={storyEditionSpinClass(edition)} />
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
                className={cn(storyEditionOverlayIconBtnClass(edition), "nodrag")}
                onPointerDown={blockCanvasPointer}
                onMouseDown={blockCanvasPointer}
                onClick={(e) => {
                  blockCanvasPointer(e);
                  onGenerate();
                }}
              >
                <RefreshCw className="size-4 pointer-events-none" />
              </button>
              {showPreview ? (
                <button
                  type="button"
                  aria-label="预览"
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
              ) : null}
            </>
          ) : (
            <button
              type="button"
              disabled={btnDisabled}
              aria-label={isFrame ? "生成分镜图" : "生成"}
              title={
                generateDisabled
                  ? isFrame
                    ? "请先在上方选择分镜图 IMAGE 模型"
                    : "请先在上方选择生图模型"
                  : undefined
              }
              className={cn(
                storyEditionIconBtnClass(edition),
                "nodrag",
                generateDisabled && "cursor-not-allowed opacity-40",
              )}
              onPointerDown={(e) => {
                if (btnDisabled) return;
                blockCanvasPointer(e);
              }}
              onMouseDown={(e) => {
                if (btnDisabled) return;
                blockCanvasPointer(e);
              }}
              onClick={(e) => {
                blockCanvasPointer(e);
                if (btnDisabled) return;
                onGenerate();
              }}
            >
              <RefreshCw className="size-4 pointer-events-none" />
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
        <StoryErrorLine message={errorMessage} />
      ) : null}
      {isFrame && videoBlockReason && hasFrameImage && !generating ? (
        <p className={`text-[10px] leading-snug ${STORY_HINT_GOLD_CLASS}`}>
          {videoBlockReason}
        </p>
      ) : null}
      {isFrame && frameRejectedReason?.trim() ? (
        <StoryErrorLine message={`驳回：${frameRejectedReason}`} />
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
