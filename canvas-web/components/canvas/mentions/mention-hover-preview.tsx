"use client";

import { createPortal } from "react-dom";
import type { MentionableItem } from "./MentionsTextarea";

const PREVIEW_W = 360;
const PREVIEW_IMAGE_H = 360;
/** 图区 + 底栏 caption · 用于 above-pointer 定位（须与实际 DOM 一致） */
const PREVIEW_TOTAL_H = PREVIEW_IMAGE_H + 40;
const PREVIEW_POINTER_GAP = 40;
const MENTION_HOVER_Z = 5100;

export type MentionHoverPreviewPlacement = "above-pointer" | "auto";

function computePreviewPosition(
  rect: DOMRect,
  previewW: number,
  previewTotalH: number,
  opts?: {
    pointerX?: number;
    pointerY?: number;
    placement?: MentionHoverPreviewPlacement;
  },
): { left: number; top: number } {
  const gap =
    opts?.placement === "above-pointer" ? PREVIEW_POINTER_GAP : 12;
  const margin = 10;
  const placement = opts?.placement ?? "auto";
  const px = opts?.pointerX ?? rect.left + rect.width / 2;
  const py = opts?.pointerY ?? rect.top;

  let left = px - previewW / 2;
  left = Math.max(
    margin,
    Math.min(window.innerWidth - previewW - margin, left),
  );

  if (placement === "above-pointer") {
    // 底边 = min(指针, 锚点顶) 上方 gap，整块浮在缩略图/操作区之上
    const anchorY = Math.min(py, rect.top);
    let top = anchorY - previewTotalH - gap;
    if (top < margin) {
      top = margin;
    }
    return { left, top };
  }

  let top = py - previewTotalH - gap;
  if (top < margin) {
    top = rect.bottom + gap;
  }
  top = Math.max(
    margin,
    Math.min(window.innerHeight - previewTotalH - margin, top),
  );
  return { left, top };
}

/** Dock @mention / 参考图 chip 悬停 · 大图预览（默认在指针上方，避免挡住缩略图） */
export function MentionHoverPreviewPortal({
  item,
  anchorRect,
  pointerX,
  pointerY,
  placement = "above-pointer",
}: {
  item: MentionableItem | null;
  anchorRect: DOMRect | null;
  pointerX?: number;
  pointerY?: number;
  placement?: MentionHoverPreviewPlacement;
}) {
  if (!item?.previewUrl || !anchorRect || typeof document === "undefined") {
    return null;
  }

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(item.previewUrl);
  const { left, top } = computePreviewPosition(
    anchorRect,
    PREVIEW_W,
    PREVIEW_TOTAL_H,
    { pointerX, pointerY, placement },
  );

  return createPortal(
    <div
      className="pointer-events-none fixed"
      style={{ left, top, width: PREVIEW_W, zIndex: MENTION_HOVER_Z }}
      aria-hidden
    >
      <div className="flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0c0c12] shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10">
        <div
          className="relative bg-black/50"
          style={{ height: PREVIEW_IMAGE_H }}
        >
          {isVideo ? (
            <video
              src={item.previewUrl}
              className="size-full object-contain"
              muted
              playsInline
              autoPlay
              loop
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- OSS / blob 预览
            <img
              src={item.previewUrl}
              alt=""
              className="size-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
        <p className="truncate border-t border-white/10 px-2.5 py-1.5 text-[11px] text-white/75">
          @{item.label}
        </p>
      </div>
    </div>,
    document.body,
  );
}
