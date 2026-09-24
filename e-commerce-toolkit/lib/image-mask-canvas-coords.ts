export type CanvasPoint = { x: number; y: number };

export type CssRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * 把指针 client 坐标映射到 canvas bitmap 像素，并钳到画布内。
 *
 * 画布 CSS 尺寸（getBoundingClientRect）经常和 width/height 属性不一致
 *（布局拉伸、圆角裁切、侧栏伸缩）。若直接用 `clientX - left`，右下角会落到
 * bitmap 外被裁掉，表现为框不到 / 框不准。
 */
export function clientPointToCanvasBitmap(
  clientX: number,
  clientY: number,
  cssRect: CssRect,
  canvasWidth: number,
  canvasHeight: number,
): CanvasPoint {
  if (
    cssRect.width <= 0 ||
    cssRect.height <= 0 ||
    canvasWidth <= 0 ||
    canvasHeight <= 0
  ) {
    return { x: 0, y: 0 };
  }
  const x = ((clientX - cssRect.left) / cssRect.width) * canvasWidth;
  const y = ((clientY - cssRect.top) / cssRect.height) * canvasHeight;
  return {
    x: clamp(x, 0, canvasWidth),
    y: clamp(y, 0, canvasHeight),
  };
}

export function pointerEventToCanvasBitmap(
  event: Pick<PointerEvent, "clientX" | "clientY">,
  canvas: Pick<HTMLCanvasElement, "width" | "height" | "getBoundingClientRect">,
): CanvasPoint {
  return clientPointToCanvasBitmap(
    event.clientX,
    event.clientY,
    canvas.getBoundingClientRect(),
    canvas.width,
    canvas.height,
  );
}
