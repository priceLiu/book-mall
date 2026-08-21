"use client";

import { useEffect } from "react";

import {
  IMAGE_ZOOM_BUTTON_STEP,
  ImageZoomControls,
} from "@/components/media/image-zoom-controls";
import { useImageZoomPan } from "@/lib/media/use-image-zoom-pan";

/** 全屏图片预览：滚轮缩放、拖拽平移、右下角 +/- 控件。规范见 image-preview-zoom-pan.mdc */
export function FullscreenImagePreview({
  src,
  title,
  onClose,
}: {
  src: string;
  title?: string;
  onClose: () => void;
}) {
  const { zoom, zoomBy, reset, stageProps } = useImageZoomPan(src);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[400]"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `图片预览：${title}` : "图片预览"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
        aria-label="关闭预览"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-4 pb-20 pt-14">
        <div
          {...stageProps}
          className="pointer-events-auto relative inline-flex max-h-full max-w-full items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title ?? ""}
            draggable={false}
            className="max-h-[calc(100vh-7rem)] max-w-[min(96vw,100%)] select-none object-contain"
          />
        </div>
      </div>

      <ImageZoomControls
        zoom={zoom}
        onZoomIn={() => zoomBy(IMAGE_ZOOM_BUTTON_STEP)}
        onZoomOut={() => zoomBy(-IMAGE_ZOOM_BUTTON_STEP)}
        onReset={reset}
        className="pointer-events-auto z-30"
      />

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

      {title ? (
        <span className="pointer-events-none absolute left-4 top-4 z-30 max-w-[50vw] truncate rounded-md bg-black/60 px-2.5 py-1 text-xs text-white">
          {title}
        </span>
      ) : null}
    </div>
  );
}
