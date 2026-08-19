/**
 * 画布图片节点 · 悬停预览 Eye（视觉参考 e-commerce-toolkit/design/MEDIA.md，尺寸加大）
 *
 * 电商资产格：h-10 / Eye h-5（40px 档）。画布 Stage 可视面积更大，基准提高到 64px 钮，
 * 并按 Stage 短边等比缩放（clamp），避免小眼睛难以点击。
 */

export type CanvasMediaPreviewChrome = {
  overlayClass: string;
  btnClass: string;
  btnSizePx: number;
  iconSizePx: number;
};

/** 200px 短边 Stage 下的目标尺寸（大于电商 40px 基准） */
const CANVAS_PREVIEW_BASE_BTN_PX = 64;
const CANVAS_PREVIEW_BASE_ICON_PX = 32;
const CANVAS_PREVIEW_REFERENCE_SHORT_PX = 200;
const CANVAS_PREVIEW_SCALE_MIN = 0.85;
const CANVAS_PREVIEW_SCALE_MAX = 1.55;

/** 悬停层：居中 + scrim（与 EcomMediaLibraryTile 一致） */
export const CANVAS_MEDIA_PREVIEW_OVERLAY_CLASS =
  "pointer-events-none absolute inset-0 z-[2] flex items-center justify-center gap-2 bg-black/0 opacity-0 transition duration-150 group-hover/media:bg-black/45 group-hover/media:opacity-100 group-focus-within/media:bg-black/45 group-focus-within/media:opacity-100";

/** 白底预览钮（尺寸由 resolveCanvasMediaPreviewChrome 写入 style） */
export const CANVAS_MEDIA_PREVIEW_BTN_CLASS =
  "nodrag pointer-events-auto inline-flex shrink-0 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow-md transition hover:bg-white hover:scale-[1.03]";

/**
 * 按 Stage 容器短边计算预览钮/图标像素尺寸。
 * @param stageShortSidePx 容器 min(width, height)
 */
export function resolveCanvasMediaPreviewChrome(
  stageShortSidePx: number,
): CanvasMediaPreviewChrome {
  const short = Math.max(72, stageShortSidePx);
  const scale = Math.min(
    CANVAS_PREVIEW_SCALE_MAX,
    Math.max(
      CANVAS_PREVIEW_SCALE_MIN,
      short / CANVAS_PREVIEW_REFERENCE_SHORT_PX,
    ),
  );
  const btnSizePx = Math.round(CANVAS_PREVIEW_BASE_BTN_PX * scale);
  const iconSizePx = Math.round(CANVAS_PREVIEW_BASE_ICON_PX * scale);
  return {
    overlayClass: CANVAS_MEDIA_PREVIEW_OVERLAY_CLASS,
    btnClass: CANVAS_MEDIA_PREVIEW_BTN_CLASS,
    btnSizePx,
    iconSizePx,
  };
}

export function readElementShortSide(el: HTMLElement | null): number {
  if (!el) return CANVAS_PREVIEW_REFERENCE_SHORT_PX;
  const { width, height } = el.getBoundingClientRect();
  const short = Math.min(width, height);
  return short > 0 ? short : CANVAS_PREVIEW_REFERENCE_SHORT_PX;
}
