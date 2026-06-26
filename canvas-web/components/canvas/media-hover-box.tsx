"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, Upload, X } from "lucide-react";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalCompareArrowKeys,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import {
  bindImageDragDropHandlers,
  firstImageFileFromDataTransfer,
} from "@/lib/canvas/image-upload-handlers";
import {
  buildSideOptions,
  canShowCompare,
  defaultCompareSides,
  type MediaCompareContext,
} from "./compare-utils";
import { CompareSplitView, CompareToolbar, useCompareSides } from "./compare-view";
import { CanvasVideoPlayer } from "./canvas-video-player";
import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";

/** 根据 URL 猜测是否为视频 */
export function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?|#|$)/i.test(url);
}

export type MediaHoverBoxProps = {
  src?: string;
  mediaKind?: "image" | "video";
  variant?: "uploadable" | "generated";
  onUpload?: () => void;
  /** 拖入图片文件时回调（与 onUpload 互补） */
  onImageFile?: (file: File) => void;
  /** 视频节点首帧封面；有则 Stage 只展示 JPEG，不预加载 mp4 */
  posterUrl?: string;
  alt?: string;
  className?: string;
  placeholder?: ReactNode;
  fit?: "cover" | "contain";
  naturalSize?: boolean;
  /** @deprecated 预览仅通过悬停 Eye 图标触发，不再点击整图/整视频 */
  clickToPreview?: boolean;
  /** 传入后预览弹层内可切换「大图 / 对比」 */
  compareContext?: MediaCompareContext;
  /** 分镜图预览：左侧展示 Prompt */
  prompt?: string;
  /** 打开时默认视图 */
  initialView?: "single" | "compare";
  /** 悬停预览 Eye 尺寸 · 图片节点用 lg（约 2×） */
  previewIconSize?: "default" | "lg";
  /** LibTV 图片节点：预览改在标题栏 Eye，Stage 不显示居中 Eye */
  hidePreviewOverlay?: boolean;
};

/** 悬停 overlay · 仅图标（无黑底药丸、无文案）— 见 design.md §15.2 */
const OVERLAY_ICON_BTN =
  "nodrag pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm transition hover:bg-black/75 hover:scale-[1.03]";
const OVERLAY_ICON_BTN_LG =
  "nodrag pointer-events-auto inline-flex size-[4.5rem] items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm transition hover:bg-black/75 hover:scale-[1.03]";

export function MediaHoverBox({
  src,
  posterUrl,
  mediaKind,
  variant = "generated",
  onUpload,
  onImageFile,
  alt = "media",
  className = "",
  placeholder,
  fit = "contain",
  naturalSize = false,
  clickToPreview: _clickToPreview = false,
  compareContext,
  prompt,
  initialView = "single",
  previewIconSize = "default",
  hidePreviewOverlay = false,
}: MediaHoverBoxProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const overlayBtnClass =
    previewIconSize === "lg" ? OVERLAY_ICON_BTN_LG : OVERLAY_ICON_BTN;
  const overlayIconClass =
    previewIconSize === "lg" ? "size-8 pointer-events-none" : "size-4 pointer-events-none";
  const { ref: lazyRef, active: mediaActive } = useLazyMediaActive();
  const kind =
    mediaKind ?? (src && isVideoMediaUrl(src) ? "video" : "image");
  const canPreview = !!src;
  const showUpload = variant === "uploadable" && (!!onUpload || !!onImageFile);
  const acceptImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      onImageFile?.(file);
    },
    [onImageFile],
  );
  const dragDrop = useMemo(
    () =>
      onImageFile
        ? bindImageDragDropHandlers(acceptImageFile)
        : null,
    [acceptImageFile, onImageFile],
  );

  const openPreview = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (canPreview) setPreviewOpen(true);
    },
    [canPreview],
  );

  const triggerUpload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onUpload?.();
    },
    [onUpload],
  );

  return (
    <>
      <div
        ref={lazyRef}
        className={`group/media relative overflow-hidden ${
          naturalSize ? "w-full" : "h-full w-full"
        } ${dragOver ? "ring-2 ring-white/30" : ""} ${className}`}
        {...(dragDrop ?? {})}
        onDragEnter={(e) => {
          dragDrop?.onDragEnter(e);
          if (firstImageFileFromDataTransfer(e.dataTransfer)) setDragOver(true);
        }}
        onDragLeave={(e) => {
          dragDrop?.onDragLeave(e);
          setDragOver(false);
        }}
        onDrop={(e) => {
          dragDrop?.onDrop(e);
          setDragOver(false);
        }}
      >
        {src && mediaActive ? (
          kind === "video" && posterUrl?.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={
                naturalSize
                  ? "block w-full"
                  : fit === "cover"
                    ? "h-full w-full object-cover"
                    : "h-full w-full object-contain"
              }
              draggable={false}
            />
          ) : kind === "video" ? (
            <video
              src={src}
              className={
                naturalSize
                  ? "block w-full"
                  : fit === "cover"
                    ? "h-full w-full object-cover"
                    : "h-full w-full object-contain"
              }
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={
                naturalSize
                  ? "block h-auto w-full object-contain"
                  : fit === "cover"
                    ? "h-full w-full object-cover"
                    : "h-full w-full object-contain"
              }
              draggable={false}
            />
          )
        ) : src ? (
          <div className="size-full animate-pulse bg-white/[0.04]" aria-hidden />
        ) : (
          placeholder
        )}

        {(showUpload || canPreview) && src ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition group-hover/media:opacity-100">
            {showUpload ? (
              <button
                type="button"
                title="上传 / 替换"
                aria-label="上传 / 替换"
                onClick={triggerUpload}
                className={overlayBtnClass}
              >
                <Upload className={overlayIconClass} strokeWidth={1.75} />
              </button>
            ) : null}
            {canPreview && !hidePreviewOverlay ? (
              <button
                type="button"
                title="预览大图"
                aria-label="预览"
                onClick={openPreview}
                className={overlayBtnClass}
              >
                <Eye className={overlayIconClass} strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        ) : null}

        {!src && showUpload ? (
          <button
            type="button"
            onClick={triggerUpload}
            className="nodrag absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 text-white/70 transition hover:bg-black/35 hover:text-white"
          >
            <span className="grid size-14 place-items-center rounded-full border border-white/20 bg-black/50">
              <Upload className="size-7" strokeWidth={1.75} />
            </span>
            <span className="text-[12px] font-medium">点击 / 拖入 / 粘贴</span>
          </button>
        ) : null}
      </div>

      {previewOpen && src ? (
        <MediaPreviewLightbox
          src={src}
          kind={kind}
          alt={alt}
          posterUrl={posterUrl}
          compareContext={compareContext}
          prompt={prompt}
          initialView={initialView}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

/** 全屏预览 / 对比一体弹层 */
export function MediaPreviewLightbox({
  src,
  kind,
  alt,
  posterUrl,
  compareContext,
  prompt,
  initialView = "single",
  onClose,
}: {
  src: string;
  kind: "image" | "video";
  alt: string;
  posterUrl?: string;
  compareContext?: MediaCompareContext;
  /** 分镜图等：单图预览时左侧展示 Prompt（约 30% 宽） */
  prompt?: string;
  initialView?: "single" | "compare";
  onClose: () => void;
}) {
  const mounted = useClientPortalMounted();
  const showCompare = compareContext ? canShowCompare(compareContext) : false;
  const splitPrompt = Boolean(prompt?.trim()) && kind === "image";
  const [view, setView] = useState<"single" | "compare">(
    initialView === "compare" && showCompare ? "compare" : "single",
  );

  const options = useMemo(
    () =>
      compareContext
        ? buildSideOptions(
            compareContext.tasks,
            compareContext.referenceImages ?? [],
          )
        : [],
    [compareContext],
  );

  const defaults = useMemo(
    () =>
      defaultCompareSides(
        options,
        compareContext?.defaultLeftId,
        compareContext?.defaultRightId,
        compareContext?.focusTaskId,
        (compareContext?.referenceImages?.length ?? 0) > 0,
      ),
    [options, compareContext],
  );

  const { leftId, rightId, setLeftId, setRightId, stepRight } =
    useCompareSides(options, defaults);

  useModalBodyScrollLock();
  useModalEscapeClose(onClose);
  useModalCompareArrowKeys(view === "compare", stepRight);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-black/94"
      role="dialog"
      aria-modal="true"
      aria-label={view === "compare" ? "图片对比" : "媒体预览"}
      onClick={onClose}
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {showCompare ? (
          <div className="flex shrink-0 rounded-full border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setView("single")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                view === "single"
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              大图
            </button>
            <button
              type="button"
              onClick={() => setView("compare")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                view === "compare"
                  ? "bg-[var(--canvas-accent)]/25 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              对比
            </button>
          </div>
        ) : (
          <p className="shrink-0 text-sm font-medium text-white">
            {splitPrompt ? alt : "预览"}
          </p>
        )}
        {view === "compare" && showCompare ? (
          <CompareToolbar
            options={options}
            leftId={leftId}
            rightId={rightId}
            onLeftChange={setLeftId}
            onRightChange={setRightId}
          />
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto shrink-0 rounded-full border border-white/10 p-1.5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white"
          aria-label="关闭"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-3">
        <div
          className="flex max-h-full max-w-full min-h-0 flex-1 flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {view === "compare" && showCompare ? (
            <CompareSplitView
              options={options}
              leftId={leftId}
              rightId={rightId}
            />
          ) : splitPrompt ? (
            <div className="flex min-h-0 flex-1 gap-3">
              <div className="flex w-[30%] min-w-0 shrink-0 flex-col border-r border-white/10 pr-3">
                <p className="mb-2 shrink-0 text-[11px] uppercase tracking-wider text-white/50">
                  Prompt
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-white/90">
                  {prompt}
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {kind === "video" ? (
                <CanvasVideoPlayer
                  src={src}
                  poster={posterUrl?.trim() || undefined}
                  autoPlay
                  className="max-h-[calc(100dvh-72px)] w-[min(98vw,960px)]"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={alt}
                  className="max-h-[calc(100dvh-56px)] max-w-[98vw] object-contain"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type { MediaCompareContext } from "./compare-utils";
