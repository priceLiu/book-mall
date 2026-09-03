"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { Eye, Play, Upload, X } from "lucide-react";
import {
  CANVAS_MEDIA_PREVIEW_LIGHTBOX_SHELL_CLASS,
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
import {
  isMediaSrcLoaded,
  markMediaSrcLoaded,
} from "@/lib/canvas/loaded-media-src-cache";
import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";
import {
  ImageZoomControls,
  IMAGE_ZOOM_BUTTON_STEP,
} from "@/components/media/image-zoom-controls";
import { useImageZoomPan } from "@/lib/media/use-image-zoom-pan";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { WizardPromptReadonly } from "@/components/canvas/mentions/wizard-prompt-readonly";
import {
  readElementShortSide,
  resolveCanvasMediaPreviewChrome,
} from "@/lib/canvas/canvas-media-preview-chrome";

/** 根据 URL 猜测是否为视频 */
export function isVideoMediaUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return (
    /\.(mp4|webm|mov|m4v|avi)(\?|#|$)/i.test(u) ||
    u.includes("/node-video/")
  );
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
  /** 与 prompt 内 @<wiz-*> 对应的 mention 列表（向导分镜图预览绿色 @） */
  promptMentionables?: MentionableItem[];
  /** 打开时默认视图 */
  initialView?: "single" | "compare";
  /** 悬停预览 Eye 尺寸 · 图片节点用 lg（约 2×） */
  previewIconSize?: "default" | "lg";
  /**
   * 预览钮视觉 · `ecom` = 白底圆钮 + scrim（对齐电商 MEDIA.md，自适应 Stage 尺寸）
   * `canvas` = 深色半透明圆钮（Story 列等 legacy）
   */
  previewChrome?: "canvas" | "ecom";
  /** LibTV 图片节点：预览改在标题栏 Eye，Stage 不显示居中 Eye */
  hidePreviewOverlay?: boolean;
  /** 图片 src 加载失败（供 OSS → blob 回退） */
  onImageError?: () => void;
  /** 图片/封面加载完成后回传 natural 尺寸（供节点外框自适配） */
  onNaturalSize?: (size: { w: number; h: number }) => void;
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
  promptMentionables,
  initialView = "single",
  previewIconSize = "default",
  previewChrome = "canvas",
  hidePreviewOverlay = false,
  onImageError,
  onNaturalSize,
}: MediaHoverBoxProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [stageShortSide, setStageShortSide] = useState(160);
  const overlayBtnClass =
    previewIconSize === "lg" ? OVERLAY_ICON_BTN_LG : OVERLAY_ICON_BTN;
  const overlayIconClass =
    previewIconSize === "lg" ? "size-8 pointer-events-none" : "size-4 pointer-events-none";
  const ecomPreviewChrome = useMemo(
    () => resolveCanvasMediaPreviewChrome(stageShortSide),
    [stageShortSide],
  );
  const alreadyLoaded = isMediaSrcLoaded(src);
  /** 画布已生成图/视频：不 lazy，避免 onlyRenderVisibleElements 重挂载时灰底 */
  const eagerMedia = variant === "generated" || alreadyLoaded;
  const { ref: lazyRef, active: mediaActive } = useLazyMediaActive(
    "240px",
    eagerMedia,
  );
  const mediaReady = mediaActive || alreadyLoaded;

  useEffect(() => {
    if (previewChrome !== "ecom" || hidePreviewOverlay || previewOpen) return;
    const el = lazyRef.current;
    if (!el) return;
    const sync = () => setStageShortSide(readElementShortSide(el));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewChrome, hidePreviewOverlay, lazyRef, previewOpen, src]);

  const markLoaded = useCallback(
    (e?: SyntheticEvent<HTMLImageElement>) => {
      markMediaSrcLoaded(src);
      const el = e?.currentTarget;
      if (el && onNaturalSize) {
        const w = el.naturalWidth || 0;
        const h = el.naturalHeight || 0;
        if (w >= 1 && h >= 1) onNaturalSize({ w, h });
      }
    },
    [src, onNaturalSize],
  );
  const kind =
    mediaKind ?? (src && isVideoMediaUrl(src) ? "video" : "image");
  const previewActionLabel = kind === "video" ? "播放" : "预览";
  const PreviewOverlayIcon = kind === "video" ? Play : Eye;
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

  const closePreview = useCallback(() => setPreviewOpen(false), []);

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
        {src && mediaReady ? (
          kind === "video" && posterUrl?.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt={alt}
              loading={eagerMedia ? "eager" : "lazy"}
              decoding="async"
              onLoad={markLoaded}
              className={
                naturalSize
                  ? "block w-full"
                  : fit === "cover"
                    ? "h-full w-full object-cover object-center"
                    : "h-full w-full object-contain object-center"
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
                    ? "h-full w-full object-cover object-center"
                    : "h-full w-full object-contain object-center"
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
              loading={eagerMedia ? "eager" : "lazy"}
              decoding="async"
              onLoad={markLoaded}
              onError={() => onImageError?.()}
              className={
                naturalSize
                  ? "block h-auto w-full object-contain"
                  : fit === "cover"
                    ? "h-full w-full object-cover object-center"
                    : "h-full w-full object-contain object-center"
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
          <div
            className={
              previewChrome === "ecom" && !hidePreviewOverlay
                ? ecomPreviewChrome.overlayClass
                : "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition group-hover/media:opacity-100"
            }
          >
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
            {canPreview && !hidePreviewOverlay && !previewOpen ? (
              previewChrome === "ecom" ? (
                <button
                  type="button"
                  title={kind === "video" ? "播放视频" : "预览大图"}
                  aria-label={previewActionLabel}
                  onClick={openPreview}
                  className={ecomPreviewChrome.btnClass}
                  style={{
                    width: ecomPreviewChrome.btnSizePx,
                    height: ecomPreviewChrome.btnSizePx,
                  }}
                >
                  <PreviewOverlayIcon
                    className={
                      kind === "video"
                        ? "pointer-events-none shrink-0 translate-x-px"
                        : "pointer-events-none shrink-0"
                    }
                    style={{
                      width: ecomPreviewChrome.iconSizePx,
                      height: ecomPreviewChrome.iconSizePx,
                    }}
                    strokeWidth={1.75}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  title={kind === "video" ? "播放视频" : "预览大图"}
                  aria-label={previewActionLabel}
                  onClick={openPreview}
                  className={overlayBtnClass}
                >
                  <PreviewOverlayIcon
                    className={
                      kind === "video"
                        ? `${overlayIconClass} translate-x-px`
                        : overlayIconClass
                    }
                    strokeWidth={1.75}
                  />
                </button>
              )
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
          promptMentionables={promptMentionables}
          initialView={initialView}
          onClose={closePreview}
        />
      ) : null}
    </>
  );
}

/** 全屏预览 / 对比一体弹层 */
function mentionablesPreviewEqual(
  a?: MentionableItem[],
  b?: MentionableItem[],
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(
    (item, i) =>
      item.id === b[i]?.id &&
      item.label === b[i]?.label &&
      item.previewUrl === b[i]?.previewUrl &&
      item.kind === b[i]?.kind,
  );
}

function mediaPreviewLightboxPropsEqual(
  prev: Readonly<{
    src: string;
    kind: "image" | "video";
    alt: string;
    posterUrl?: string;
    compareContext?: MediaCompareContext;
    prompt?: string;
    promptMentionables?: MentionableItem[];
    initialView?: "single" | "compare";
    onClose: () => void;
  }>,
  next: typeof prev,
): boolean {
  return (
    prev.src === next.src &&
    prev.kind === next.kind &&
    prev.alt === next.alt &&
    prev.posterUrl === next.posterUrl &&
    prev.compareContext === next.compareContext &&
    prev.prompt === next.prompt &&
    prev.initialView === next.initialView &&
    prev.onClose === next.onClose &&
    mentionablesPreviewEqual(prev.promptMentionables, next.promptMentionables)
  );
}

export const MediaPreviewLightbox = memo(function MediaPreviewLightbox({
  src,
  kind,
  alt,
  posterUrl,
  compareContext,
  prompt,
  promptMentionables,
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
  promptMentionables?: MentionableItem[];
  initialView?: "single" | "compare";
  onClose: () => void;
}) {
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

  const { zoom, zoomBy, reset, stageProps } = useImageZoomPan(src);
  /** 对比视图有自己的交互，只在单图预览挂缩放 */
  const zoomable = kind === "image" && view === "single";

  // 用户点击触发，仅客户端挂载 — 跳过 portal defer，避免首帧 null → 弹层闪一下
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={CANVAS_MEDIA_PREVIEW_LIGHTBOX_SHELL_CLASS}
      role="dialog"
      aria-modal="true"
      aria-label={view === "compare" ? "图片对比" : "媒体预览"}
      onClick={onClose}
    >
      <header
        className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#0a0a0c] px-3 py-2 sm:px-4"
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
          className="ml-auto shrink-0 rounded-full border border-white/20 bg-black/40 p-1.5 text-white/85 shadow-lg hover:border-white/35 hover:bg-white/10 hover:text-white"
          aria-label="关闭"
        >
          <X className="size-5" />
        </button>
      </header>

      <p className="pointer-events-none absolute left-1/2 top-14 z-10 -translate-x-1/2 text-[11px] text-white/35">
        点击背景或按 Esc 关闭
      </p>

      <div
        className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-3"
        onClick={onClose}
      >
        {view === "compare" && showCompare ? (
          <div
            className="flex max-h-full max-w-full min-h-0 flex-1 flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CompareSplitView
              options={options}
              leftId={leftId}
              rightId={rightId}
            />
          </div>
        ) : splitPrompt ? (
          <div className="flex min-h-0 max-h-full max-w-full flex-1 gap-3">
            <div className="flex w-[30%] min-w-0 shrink-0 flex-col border-r border-white/10 pr-3">
              <p className="mb-2 shrink-0 text-[11px] uppercase tracking-wider text-white/50">
                Prompt
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {promptMentionables?.length ? (
                  <WizardPromptReadonly
                    value={prompt ?? ""}
                    mentionables={promptMentionables}
                  />
                ) : (
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/90">
                    {prompt}
                  </div>
                )}
              </div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
              <div
                {...stageProps}
                className="inline-block leading-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  draggable={false}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {kind === "video" ? (
              <div onClick={(e) => e.stopPropagation()}>
                <CanvasVideoPlayer
                  src={src}
                  poster={posterUrl?.trim() || undefined}
                  autoPlay
                />
              </div>
            ) : (
              <div
                {...stageProps}
                className="inline-block leading-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  draggable={false}
                  className="max-h-[calc(100dvh-56px)] max-w-[98vw] object-contain"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {zoomable ? (
        // 根节点 onClick 会关闭预览，控件须拦住冒泡
        <div onClick={(e) => e.stopPropagation()}>
          <ImageZoomControls
            zoom={zoom}
            onZoomIn={() => zoomBy(IMAGE_ZOOM_BUTTON_STEP)}
            onZoomOut={() => zoomBy(-IMAGE_ZOOM_BUTTON_STEP)}
            onReset={reset}
          />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}, mediaPreviewLightboxPropsEqual);

export type { MediaCompareContext } from "./compare-utils";
