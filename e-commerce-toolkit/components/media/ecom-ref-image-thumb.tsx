"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  onRemove?: () => void;
  removeLabel?: string;
};

const PREVIEW_W = 240;
const PREVIEW_MAX_H = 272;
const VIEWPORT_PAD = 8;

function computePreviewPos(anchor: DOMRect): { top: number; left: number } {
  const previewW = Math.min(PREVIEW_W, window.innerWidth * 0.55);
  const previewH = PREVIEW_MAX_H + 28;

  let left = anchor.left - previewW - VIEWPORT_PAD;
  if (left < VIEWPORT_PAD) {
    left = anchor.right + VIEWPORT_PAD;
  }
  if (left + previewW > window.innerWidth - VIEWPORT_PAD) {
    left = Math.max(
      VIEWPORT_PAD,
      Math.min(left, window.innerWidth - previewW - VIEWPORT_PAD),
    );
  }

  let top = anchor.top + anchor.height / 2 - previewH / 2;
  top = Math.max(
    VIEWPORT_PAD,
    Math.min(top, window.innerHeight - previewH - VIEWPORT_PAD),
  );

  return { top, left };
}

/** 参考图缩略图：悬停显示放大预览（fixed + portal，避免被侧栏 overflow 裁切） */
export function EcomRefImageThumb({
  src,
  alt,
  size = 56,
  className,
  onRemove,
  removeLabel = "删除",
}: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setPos(computePreviewPos(el.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!hover) {
      setPos(null);
      return;
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [hover, updatePos]);

  const previewW = typeof window !== "undefined"
    ? Math.min(PREVIEW_W, window.innerWidth * 0.55)
    : PREVIEW_W;

  return (
    <>
      <div
        ref={anchorRef}
        className={cn("group relative shrink-0", className)}
        style={{ width: size, height: size }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-md border border-[#d2d2d7] bg-white"
          title={alt}
        >
          <Image src={src} alt={alt} fill className="object-cover" unoptimized />
        </div>

        {onRemove ? (
          <button
            type="button"
            className="absolute right-0.5 top-0.5 z-[1] rounded-full bg-black/65 p-0.5 text-white opacity-100 transition group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={removeLabel}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {mounted && hover && pos
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[200] overflow-hidden rounded-xl border border-[#d2d2d7] bg-white p-1 shadow-xl ring-1 ring-black/5"
              style={{ top: pos.top, left: pos.left, width: previewW }}
              role="tooltip"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-h-64 w-full rounded-lg object-contain"
              />
              <p className="truncate px-1.5 py-1 text-[10px] text-[#6e6e73]">{alt}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
