"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { QrMediaLoadProgress } from "@/components/quick-replica/qr-media-load-progress";
import {
  IMAGE_ZOOM_BUTTON_STEP,
  ImageZoomControls,
} from "@/components/media/image-zoom-controls";
import { useImageZoomPan } from "@/lib/media/use-image-zoom-pan";
import { useQrRemoteImageLoad } from "@/lib/use-qr-remote-image-load";

/** 画布图片节点同款：全屏 contain、滚轮缩放、右下角 +/- */
export function QrFullscreenImagePreview({
  src,
  title,
  onClose,
}: {
  src: string;
  title?: string;
  onClose: () => void;
}) {
  const {
    displaySrc,
    progress,
    indeterminate,
    ready,
    onImgLoad,
    onImgError,
  } = useQrRemoteImageLoad(src);
  const { zoom, zoomBy, reset, stageProps } = useImageZoomPan(displaySrc);

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80]"
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

      <QrMediaLoadProgress
        active={!ready}
        ratio={progress}
        indeterminate={indeterminate}
        label={indeterminate ? "加载原图…" : undefined}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-4 pb-20 pt-14">
        <div
          {...stageProps}
          className={`pointer-events-auto relative inline-flex max-h-full max-w-full items-center justify-center transition-opacity duration-200${ready ? " opacity-100" : " opacity-0"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt={title ?? ""}
            draggable={false}
            onLoad={onImgLoad}
            onError={onImgError}
            className="max-h-[calc(100dvh-7rem)] max-w-[min(96vw,100%)] select-none object-contain"
          />
        </div>
      </div>

      {ready ? (
        <div onClick={(e) => e.stopPropagation()}>
          <ImageZoomControls
            zoom={zoom}
            onZoomIn={() => zoomBy(IMAGE_ZOOM_BUTTON_STEP)}
            onZoomOut={() => zoomBy(-IMAGE_ZOOM_BUTTON_STEP)}
            onReset={reset}
            className="pointer-events-auto z-30"
          />
        </div>
      ) : null}

      <button
        type="button"
        className="absolute right-4 top-4 z-30 rounded-full border border-white/20 bg-black/70 p-1.5 text-white/90 hover:bg-white/10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>
    </div>,
    document.body,
  );
}
