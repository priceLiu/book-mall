"use client";

/**
 * 图片预览右下角的缩放控件。规范见 `.cursor/rules/image-preview-zoom-pan.mdc`。
 *
 * 与 `lib/media/use-image-zoom-pan.ts` 同为 **规范实现**，由
 * `node scripts/sync-image-zoom-pan.mjs` 逐字同步到其余子应用；改这里再同步。
 *
 * 图标内联 SVG 而非 lucide：各子应用图标库不一致，内联才能保证副本编译通过、外观一致。
 */

import {
  IMAGE_ZOOM_BUTTON_STEP,
  IMAGE_ZOOM_MAX,
  IMAGE_ZOOM_MIN,
} from "@/lib/media/use-image-zoom-pan";

const BUTTON_CLASS = [
  "flex h-8 w-8 items-center justify-center rounded-full",
  "bg-black/75 text-white shadow-md backdrop-blur-sm transition-colors",
  "hover:bg-black focus:outline-none focus:ring-2 focus:ring-white/40",
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black/75",
].join(" ");

function IconZoomOut() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5M8 11h6" />
    </svg>
  );
}

function IconZoomIn() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5M8 11h6M11 8v6" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

/**
 * 必须与缩放容器同级（而非其子元素），否则会被一起 scale。
 * 用 absolute 而非 fixed：父层若带 transform 会成为 fixed 的包含块，定位会跑偏。
 */
export function ImageZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
}) {
  return (
    <div
      className={
        "absolute bottom-4 right-4 z-20 flex items-center gap-2 " +
        (className ?? "")
      }
    >
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onZoomOut}
        disabled={zoom <= IMAGE_ZOOM_MIN}
        aria-label="缩小"
        title="缩小（滚轮向下）"
      >
        <IconZoomOut />
      </button>
      <span className="min-w-[3.25rem] rounded-full bg-black/75 px-2 py-1 text-center text-[11px] font-medium text-white backdrop-blur-sm">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onZoomIn}
        disabled={zoom >= IMAGE_ZOOM_MAX}
        aria-label="放大"
        title="放大（滚轮向上）"
      >
        <IconZoomIn />
      </button>
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onReset}
        disabled={zoom === IMAGE_ZOOM_MIN}
        aria-label="还原"
        title="还原（双击图片）"
      >
        <IconReset />
      </button>
    </div>
  );
}

export { IMAGE_ZOOM_BUTTON_STEP };
