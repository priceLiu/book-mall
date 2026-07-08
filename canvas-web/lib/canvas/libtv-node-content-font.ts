/** 节点内正文 · 屏上恒定字号（flow 字号 = screen / canvasZoom） */

export const TAG_NODE_TOOLBAR_FONT_SCREEN_PX = 15;
export const TAG_NODE_BODY_FONT_SCREEN_PX = 17;

export function libtvNodeScreenFontToFlowPx(
  screenPx: number,
  canvasZoom: number,
): number {
  const z = Math.max(
    0.08,
    Number.isFinite(canvasZoom) && canvasZoom > 0 ? canvasZoom : 1,
  );
  return screenPx / z;
}
