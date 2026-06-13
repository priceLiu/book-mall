"use client";

import { createPortal } from "react-dom";
import type { MentionableItem } from "./MentionsTextarea";

const PREVIEW_W = 280;
const PREVIEW_H = 280;
const MENTION_HOVER_Z = 5100;

function computePreviewPosition(
  rect: DOMRect,
  previewW: number,
  previewH: number,
): { left: number; top: number } {
  const gap = 12;
  const margin = 10;
  let left = rect.left + rect.width / 2 - previewW / 2;
  let top = rect.top - previewH - gap;

  if (top < margin) {
    top = rect.bottom + gap;
  }
  left = Math.max(
    margin,
    Math.min(window.innerWidth - previewW - margin, left),
  );
  top = Math.max(
    margin,
    Math.min(window.innerHeight - previewH - margin, top),
  );
  return { left, top };
}

/** Dock @mention 悬停 · 图片/视频缩略预览 */
export function MentionHoverPreviewPortal({
  item,
  anchorRect,
}: {
  item: MentionableItem | null;
  anchorRect: DOMRect | null;
}) {
  if (!item?.previewUrl || !anchorRect || typeof document === "undefined") {
    return null;
  }

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(item.previewUrl);
  const { left, top } = computePreviewPosition(
    anchorRect,
    PREVIEW_W,
    PREVIEW_H,
  );

  return createPortal(
    <div
      className="pointer-events-none fixed"
      style={{ left, top, width: PREVIEW_W, zIndex: MENTION_HOVER_Z }}
      aria-hidden
    >
      <div className="flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0c0c12] shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10">
        <div className="relative aspect-square bg-black/50">
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
