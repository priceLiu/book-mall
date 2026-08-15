"use client";

/**
 * 后台列表里的缩略图：悬停即浮出大图，点击进全屏。
 *
 * 全屏预览的滚轮缩放 / 拖拽平移走全站规范实现（`.cursor/rules/image-preview-zoom-pan.mdc`），
 * 不要在这里另写一套缩放逻辑。
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  IMAGE_ZOOM_BUTTON_STEP,
  ImageZoomControls,
} from "@/components/media/image-zoom-controls";
import { useImageZoomPan } from "@/lib/media/use-image-zoom-pan";

const HOVER_WIDTH = 360;
const HOVER_GAP = 12;

/** 贴着缩略图放，右侧放不下就翻到左侧；上下夹在视口内 */
function hoverPosition(rect: DOMRect): { left: number; top: number } {
  const maxHeight = window.innerHeight * 0.8;
  const left =
    rect.right + HOVER_GAP + HOVER_WIDTH <= window.innerWidth
      ? rect.right + HOVER_GAP
      : Math.max(HOVER_GAP, rect.left - HOVER_GAP - HOVER_WIDTH);
  const top = Math.min(
    Math.max(HOVER_GAP, rect.top + rect.height / 2 - maxHeight / 2),
    Math.max(HOVER_GAP, window.innerHeight - maxHeight - HOVER_GAP),
  );
  return { left, top };
}

function FullscreenPreview({
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-black/90"
      onClick={onClose}
    >
      <div
        {...stageProps}
        className="relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title ?? ""}
          draggable={false}
          className="max-h-[92vh] max-w-[92vw] object-contain"
        />
      </div>
      <ImageZoomControls
        zoom={zoom}
        onZoomIn={() => zoomBy(IMAGE_ZOOM_BUTTON_STEP)}
        onZoomOut={() => zoomBy(-IMAGE_ZOOM_BUTTON_STEP)}
        onReset={reset}
      />
      <button
        type="button"
        className="absolute right-4 top-4 z-20 rounded-full bg-black/75 px-3 py-1.5 text-xs text-white hover:bg-black"
        onClick={onClose}
      >
        关闭
      </button>
      {title ? (
        <span className="pointer-events-none absolute left-4 top-4 z-20 max-w-[50vw] truncate rounded-md bg-black/60 px-2.5 py-1 text-xs text-white">
          {title}
        </span>
      ) : null}
    </div>
  );
}

export function AdminMediaThumb({
  src,
  title,
  className = "h-24 w-20",
}: {
  src: string;
  title?: string;
  className?: string;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!src) {
    return (
      <div
        className={`${className} rounded border border-dashed border-[#d0d7de] bg-[#f6f8fa]`}
      />
    );
  }

  const hover = rect && !fullscreen ? hoverPosition(rect) : null;

  return (
    <>
      <button
        type="button"
        title="点击查看大图"
        className={`${className} block overflow-hidden rounded border border-[#d0d7de] bg-[#f6f8fa]`}
        onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setRect(null)}
        onClick={() => {
          setRect(null);
          setFullscreen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </button>

      {mounted && hover
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[250] rounded-lg border border-[#d0d7de] bg-white p-1 shadow-2xl"
              style={{
                left: hover.left,
                top: hover.top,
                width: HOVER_WIDTH,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="max-h-[80vh] w-full rounded object-contain"
              />
            </div>,
            document.body,
          )
        : null}

      {mounted && fullscreen
        ? createPortal(
            <FullscreenPreview
              src={src}
              title={title}
              onClose={() => setFullscreen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
