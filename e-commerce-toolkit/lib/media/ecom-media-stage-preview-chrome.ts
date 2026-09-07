/**
 * 工作区 Stage 悬停预览钮（对齐 canvas `canvas-media-preview-chrome.ts` · 磨砂 Play / Eye）
 */

export type EcomMediaStagePreviewChrome = {
  overlayClass: string;
  btnClass: string;
  btnSizePx: number;
  iconSizePx: number;
};

const STAGE_PREVIEW_BASE_BTN_PX = 64;
const STAGE_PREVIEW_BASE_ICON_PX = 32;
const STAGE_PREVIEW_REFERENCE_SHORT_PX = 200;
const STAGE_PREVIEW_SCALE_MIN = 0.85;
const STAGE_PREVIEW_SCALE_MAX = 1.55;

export const ECOM_MEDIA_STAGE_PREVIEW_OVERLAY_CLASS =
  "pointer-events-none absolute inset-0 z-[2] flex items-center justify-center gap-2 bg-black/0 opacity-0 transition duration-150 group-hover/stage:bg-black/45 group-hover/stage:opacity-100 group-focus-within/stage:bg-black/45 group-focus-within/stage:opacity-100";

export const ECOM_MEDIA_STAGE_PREVIEW_BTN_CLASS =
  "pointer-events-auto inline-flex shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/25 text-[#1d1d1f] shadow-lg ring-1 ring-black/[0.06] backdrop-blur-md transition hover:bg-white/35 hover:scale-[1.03]";

export function resolveEcomMediaStagePreviewChrome(
  stageShortSidePx: number,
): EcomMediaStagePreviewChrome {
  const short = Math.max(72, stageShortSidePx);
  const scale = Math.min(
    STAGE_PREVIEW_SCALE_MAX,
    Math.max(
      STAGE_PREVIEW_SCALE_MIN,
      short / STAGE_PREVIEW_REFERENCE_SHORT_PX,
    ),
  );
  const btnSizePx = Math.round(STAGE_PREVIEW_BASE_BTN_PX * scale);
  const iconSizePx = Math.round(STAGE_PREVIEW_BASE_ICON_PX * scale);
  return {
    overlayClass: ECOM_MEDIA_STAGE_PREVIEW_OVERLAY_CLASS,
    btnClass: ECOM_MEDIA_STAGE_PREVIEW_BTN_CLASS,
    btnSizePx,
    iconSizePx,
  };
}

export function readEcomMediaStageShortSide(el: HTMLElement | null): number {
  if (!el) return STAGE_PREVIEW_REFERENCE_SHORT_PX;
  const { width, height } = el.getBoundingClientRect();
  const short = Math.min(width, height);
  return short > 0 ? short : STAGE_PREVIEW_REFERENCE_SHORT_PX;
}
