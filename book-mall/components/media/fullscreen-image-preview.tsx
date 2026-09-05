"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  IMAGE_ZOOM_BUTTON_STEP,
  ImageZoomControls,
} from "@/components/media/image-zoom-controls";
import {
  buildEcomImagePreviewOpenState,
  findEcomImagePreviewIndex,
  type EcomImagePreviewItem,
  type EcomImagePreviewOpenState,
} from "@/lib/media/ecom-image-preview";
import { useImageZoomPan } from "@/lib/media/use-image-zoom-pan";

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
      {items.map((item, i) => (
        <button
          key={`${item.src}-${i}`}
          type="button"
          data-preview-thumb-index={i}
          title={item.title}
          className={
            "relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg border-2 bg-black/40 transition " +
            (i === activeIndex
              ? "border-white ring-1 ring-white/30"
              : "border-transparent opacity-70 hover:opacity-100")
          }
          onClick={(e) => {
            e.stopPropagation();
            onSelect(i);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbSrc?.trim() || item.src}
            alt={item.title}
            className="h-full w-full object-cover"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1 py-1 text-[9px] font-medium leading-tight text-white/95 line-clamp-2">
            {item.title}
          </span>
        </button>
      ))}
    </aside>
  );
}

/** 全屏图片预览：滚轮缩放、拖拽平移、右下角 +/- 控件；可选右侧缩略条。规范见 image-preview-zoom-pan.mdc */
export function FullscreenImagePreview({
  src,
  title,
  items,
  initialIndex = 0,
  onClose,
}: {
  src: string;
  title?: string;
  items?: EcomImagePreviewItem[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const gallery = useMemo(() => {
    if (items && items.length > 0) return items;
    return [{ src, title: title ?? "图片预览" }];
  }, [items, src, title]);

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, gallery.length - 1)),
  );
  const showStrip = gallery.length > 1;
  const active = gallery[activeIndex]!;
  const { zoom, zoomBy, reset, stageProps } = useImageZoomPan(active.src);

  useEffect(() => {
    const idx = findEcomImagePreviewIndex(gallery, src);
    setActiveIndex(idx >= 0 ? idx : Math.min(Math.max(0, initialIndex), gallery.length - 1));
  }, [src, initialIndex, gallery]);

  const goPrev = useCallback(() => {
    if (gallery.length <= 1) return;
    setActiveIndex((i) => (i <= 0 ? gallery.length - 1 : i - 1));
  }, [gallery.length]);

  const goNext = useCallback(() => {
    if (gallery.length <= 1) return;
    setActiveIndex((i) => (i >= gallery.length - 1 ? 0 : i + 1));
  }, [gallery.length]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (gallery.length > 1) {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          goPrev();
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          goNext();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, gallery.length, goPrev, goNext]);

  const dialogTitle =
    showStrip && gallery.length > 1
      ? `${active.title}（${activeIndex + 1} / ${gallery.length}）`
      : active.title;

  return (
    <div
      className="fixed inset-0 z-[400] flex bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={dialogTitle ? `图片预览：${dialogTitle}` : "图片预览"}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="关闭预览"
      />

      <div
        className={
          "relative z-10 flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-20 pt-14 " +
          (showStrip ? "" : "mx-auto")
        }
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          {...stageProps}
          className="pointer-events-auto relative inline-flex max-h-full max-w-full items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.src}
            alt={active.title}
            draggable={false}
            className={
              showStrip
                ? "max-h-[calc(100vh-7rem)] max-w-[min(calc(100vw-7.5rem),78vw)] select-none object-contain"
                : "max-h-[calc(100vh-7rem)] max-w-[min(96vw,100%)] select-none object-contain"
            }
          />
        </div>

        <ImageZoomControls
          zoom={zoom}
          onZoomIn={() => zoomBy(IMAGE_ZOOM_BUTTON_STEP)}
          onZoomOut={() => zoomBy(-IMAGE_ZOOM_BUTTON_STEP)}
          onReset={reset}
          className="pointer-events-auto z-30"
        />
      </div>

      {showStrip ? (
        <div className="relative z-10 flex h-full shrink-0">
          <PreviewThumbnailStrip
            items={gallery}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
          />
        </div>
      ) : null}

      <button
        type="button"
        className="absolute right-4 top-4 z-30 rounded-full bg-black/75 px-3 py-1.5 text-xs text-white hover:bg-black"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        关闭
      </button>

      {dialogTitle ? (
        <span className="pointer-events-none absolute left-4 top-4 z-30 max-w-[50vw] truncate rounded-md bg-black/60 px-2.5 py-1 text-xs text-white">
          {dialogTitle}
        </span>
      ) : null}
    </div>
  );
}

export type { EcomImagePreviewItem, EcomImagePreviewOpenState };
export { buildEcomImagePreviewOpenState, findEcomImagePreviewIndex };
