"use client";

/**
 * 后台列表里的缩略图：悬停即浮出大图，点击进全屏。
 *
 * 全屏预览的滚轮缩放 / 拖拽平移走全站规范实现（`.cursor/rules/image-preview-zoom-pan.mdc`），
 * 不要在这里另写一套缩放逻辑。
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye } from "lucide-react";

import { FullscreenImagePreview } from "@/components/media/fullscreen-image-preview";

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
  return <FullscreenImagePreview src={src} title={title} onClose={onClose} />;
}

export function AdminMediaThumb({
  src,
  title,
  className = "h-24 w-20",
  /** float = 悬停浮出大图（电商）；icon = 悬停 Eye，点击全屏（快速复制 / 画布图片节点） */
  hoverMode = "float",
}: {
  src: string;
  title?: string;
  className?: string;
  hoverMode?: "float" | "icon";
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

  const hover = rect && !fullscreen && hoverMode === "float" ? hoverPosition(rect) : null;

  if (hoverMode === "icon") {
    return (
      <>
        <div
          className={`group/media relative ${className} overflow-hidden rounded border border-[#d0d7de] bg-[#f6f8fa]`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover/media:opacity-100">
            <button
              type="button"
              title="预览大图"
              aria-label="预览大图"
              className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm transition hover:scale-[1.03] hover:bg-black/75"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreen(true);
              }}
            >
              <Eye className="size-4 pointer-events-none" strokeWidth={1.75} />
            </button>
          </div>
        </div>
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
