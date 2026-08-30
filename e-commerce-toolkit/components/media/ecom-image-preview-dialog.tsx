"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ImageZoomControls,
  IMAGE_ZOOM_BUTTON_STEP,
} from "@/components/media/image-zoom-controls";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import {
  useImageZoomPan,
  type ImageZoomPanStageProps,
} from "@/lib/media/use-image-zoom-pan";
import { cn } from "@/lib/utils";
import type { EcomImagePreviewItem } from "@/lib/media/ecom-image-preview";

export type { EcomImagePreviewItem } from "@/lib/media/ecom-image-preview";

/** 先缩略图占位，原图加载完成后 crossfade 换上 */
function EcomPreviewImageStage({
  src,
  thumbSrc,
  alt,
  stageProps,
  compact,
}: {
  src: string;
  thumbSrc?: string;
  alt: string;
  stageProps: ImageZoomPanStageProps;
  /** 右侧缩略条时缩小主图可用宽度 */
  compact?: boolean;
}) {
  const thumb = useMemo(
    () => thumbSrc?.trim() || buildEcomOssThumbUrl(src),
    [src, thumbSrc],
  );
  const [fullLoaded, setFullLoaded] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [thumbReady, setThumbReady] = useState(false);

  useEffect(() => {
    setFullLoaded(false);
    setFullFailed(false);
    setNaturalSize(null);
    setThumbReady(false);
  }, [src, thumbSrc]);

  const onImageMeta = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
    img.onload = () => {
      onImageMeta(img);
      setFullLoaded(true);
    };
    img.onerror = () => setFullFailed(true);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onImageMeta]);

  const showProgress = !fullLoaded && !fullFailed;
  const intrinsicClass = compact
    ? "block max-h-[90vh] max-w-[min(calc(100vw-7.5rem),78vw)] w-auto h-auto"
    : "block max-h-[90vh] max-w-[96vw] w-auto h-auto";
  const skeletonClass = compact
    ? "ecom-skeleton aspect-[3/4] max-h-[90vh] w-[min(calc(100vw-7.5rem),420px)] rounded-sm bg-white/10"
    : "ecom-skeleton aspect-[3/4] max-h-[90vh] w-[min(72vw,420px)] rounded-sm bg-white/10";

  return (
    <div
      {...stageProps}
      className="relative inline-block leading-none"
      aria-busy={showProgress}
      aria-label={alt}
    >
      {showProgress && !thumbReady ? (
        <div className={skeletonClass} aria-hidden />
      ) : null}

      {fullLoaded ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          width={naturalSize?.w}
          height={naturalSize?.h}
          className={cn(intrinsicClass, "relative z-[2] opacity-100")}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumb}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          onLoad={(e) => {
            onImageMeta(e.currentTarget);
            setThumbReady(true);
          }}
          className={cn(
            intrinsicClass,
            "relative transition-opacity duration-300 ease-out",
            thumbReady ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {showProgress ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-3 z-[3] flex justify-center px-6"
          aria-hidden
        >
          <div className="w-[min(160px,50%)]">
            <div className="ecom-upload-progress ecom-upload-progress-indeterminate bg-white/20 [&>span]:bg-white/90">
              <span />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewThumbnailStrip({
  items,
  activeIndex,
  onSelect,
}: {
  items: EcomImagePreviewItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-preview-thumb-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <aside
      ref={listRef}
      className="ecom-scrollbar-thin flex h-full w-[5.5rem] shrink-0 flex-col gap-2 overflow-y-auto border-l border-white/10 p-2 sm:w-[6.5rem]"
    >
      {items.map((item, i) => {
        const thumb = item.thumbSrc?.trim() || buildEcomOssThumbUrl(item.src);
        return (
          <button
            key={`${item.src}-${i}`}
            type="button"
            data-preview-thumb-index={i}
            title={item.title}
            className={cn(
              "relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg border-2 bg-black/40 transition",
              i === activeIndex
                ? "border-white ring-1 ring-white/30"
                : "border-transparent opacity-70 hover:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt={item.title} className="h-full w-full object-cover" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1 py-1 text-[9px] font-medium leading-tight text-white/95 line-clamp-2">
              {item.title}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

/**
 * 全站统一的图片放大预览：全屏暗底 + 滚轮缩放 + 拖拽平移 + 右下角控件。
 * 传入 `items` 时右侧显示竖列缩略图，可切换同组图片（缩放/平移行为不变）。
 * 交互规范见 `.cursor/rules/image-preview-zoom-pan.mdc`。
 */
export function EcomImagePreviewDialog({
  src,
  thumbSrc,
  items,
  initialIndex = 0,
  open,
  onOpenChange,
  title = "图片预览",
}: {
  src: string;
  thumbSrc?: string;
  /** 同页多图预览；省略时仅展示 `src` 单张 */
  items?: EcomImagePreviewItem[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  const gallery = useMemo(() => {
    if (items && items.length > 0) return items;
    return [{ src, title, thumbSrc }];
  }, [items, src, title, thumbSrc]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const showStrip = gallery.length > 1;
  const active = gallery[Math.min(Math.max(0, activeIndex), gallery.length - 1)]!;
  const { zoom, zoomBy, reset, stageProps } = useImageZoomPan(active.src);

  useEffect(() => {
    if (!open) return;
    const clamped = Math.min(
      Math.max(0, initialIndex),
      Math.max(0, gallery.length - 1),
    );
    setActiveIndex(clamped);
  }, [open, initialIndex, gallery.length]);

  const goPrev = useCallback(() => {
    if (gallery.length <= 1) return;
    setActiveIndex((i) => (i <= 0 ? gallery.length - 1 : i - 1));
  }, [gallery.length]);

  const goNext = useCallback(() => {
    if (gallery.length <= 1) return;
    setActiveIndex((i) => (i >= gallery.length - 1 ? 0 : i + 1));
  }, [gallery.length]);

  useEffect(() => {
    if (!open || gallery.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, gallery.length, goPrev, goNext]);

  const dialogTitle =
    showStrip && gallery.length > 1
      ? `${active.title}（${activeIndex + 1} / ${gallery.length}）`
      : active.title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-hidden border-0 bg-black/90 p-0 shadow-none sm:rounded-none",
          "translate-x-[-50%] translate-y-[-50%]",
          showStrip ? "flex-row items-stretch" : "items-center justify-center",
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>

        <div
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1 items-center justify-center",
            showStrip ? "h-full" : "size-full",
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <EcomPreviewImageStage
            src={active.src}
            thumbSrc={active.thumbSrc}
            alt={active.title}
            stageProps={stageProps}
            compact={showStrip}
          />
          <ImageZoomControls
            zoom={zoom}
            onZoomIn={() => zoomBy(IMAGE_ZOOM_BUTTON_STEP)}
            onZoomOut={() => zoomBy(-IMAGE_ZOOM_BUTTON_STEP)}
            onReset={reset}
          />
        </div>

        {showStrip ? (
          <PreviewThumbnailStrip
            items={gallery}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
