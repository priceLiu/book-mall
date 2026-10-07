/** 与合成端 resize 整图（不裁剪）一致：在预览框内 object-contain 的内容区 */
export function computeImageContainRect(
  frameW: number,
  frameH: number,
  imageW: number,
  imageH: number,
): { x: number; y: number; w: number; h: number } {
  if (frameW <= 0 || frameH <= 0 || imageW <= 0 || imageH <= 0) {
    return { x: 0, y: 0, w: frameW, h: frameH };
  }
  const scale = Math.min(frameW / imageW, frameH / imageH);
  const w = imageW * scale;
  const h = imageH * scale;
  return {
    x: (frameW - w) / 2,
    y: (frameH - h) / 2,
    w,
    h,
  };
}

/** 预览像素 → 与合成一致的 0–1 坐标（相对成图宽高） */
export function pointerToNormalized(
  clientX: number,
  clientY: number,
  frameRect: DOMRect,
  content: { x: number; y: number; w: number; h: number },
): { nx: number; ny: number } {
  const lx = clientX - frameRect.left - content.x;
  const ly = clientY - frameRect.top - content.y;
  return {
    nx: Math.max(0, Math.min(1, lx / Math.max(1, content.w))),
    ny: Math.max(0, Math.min(1, ly / Math.max(1, content.h))),
  };
}
