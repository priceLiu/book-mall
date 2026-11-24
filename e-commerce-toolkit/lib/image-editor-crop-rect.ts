export type ImageEditorCropRect = { x: number; y: number; w: number; h: number };

export function cropRectForRatio(
  naturalW: number,
  naturalH: number,
  ratioW: number,
  ratioH: number,
): ImageEditorCropRect {
  const nw = Math.max(1, naturalW);
  const nh = Math.max(1, naturalH);
  const target = ratioW / Math.max(0.0001, ratioH);
  const image = nw / nh;
  if (image > target) {
    const w = nh * target;
    return { x: (nw - w) / 2, y: 0, w, h: nh };
  }
  const h = nw / target;
  return { x: 0, y: (nh - h) / 2, w: nw, h };
}

export function fullImageCropRect(naturalW: number, naturalH: number): ImageEditorCropRect {
  return { x: 0, y: 0, w: Math.max(1, naturalW), h: Math.max(1, naturalH) };
}

export function clampImageEditorCropRect(
  rect: ImageEditorCropRect,
  maxW: number,
  maxH: number,
): ImageEditorCropRect {
  const min = 32;
  let w = Math.min(maxW, Math.max(min, rect.w));
  let h = Math.min(maxH, Math.max(min, rect.h));
  let x = Math.min(Math.max(0, rect.x), Math.max(0, maxW - w));
  let y = Math.min(Math.max(0, rect.y), Math.max(0, maxH - h));
  if (x + w > maxW) w = maxW - x;
  if (y + h > maxH) h = maxH - y;
  return { x, y, w: Math.max(min, w), h: Math.max(min, h) };
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** 在原图像素空间拖裁切窗：底图不动，只改窗口 */
export function dragImageEditorCropRect(
  handle: Handle,
  start: ImageEditorCropRect,
  dx: number,
  dy: number,
  lockAspect: boolean,
  maxW: number,
  maxH: number,
): ImageEditorCropRect {
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const aspect = start.w / Math.max(1, start.h);
  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;

  const touchW = handle === "w" || handle === "nw" || handle === "sw";
  const touchE = handle === "e" || handle === "ne" || handle === "se";
  const touchN = handle === "n" || handle === "nw" || handle === "ne";
  const touchS = handle === "s" || handle === "sw" || handle === "se";

  if (touchE) w = start.w + dx;
  if (touchW) {
    x = start.x + dx;
    w = right - x;
  }
  if (touchS) h = start.h + dy;
  if (touchN) {
    y = start.y + dy;
    h = bottom - y;
  }

  if (lockAspect) {
    if (touchE || touchW) {
      h = w / aspect;
      if (!touchN && !touchS) y = start.y + (start.h - h) / 2;
    } else if (touchN || touchS) {
      w = h * aspect;
      if (!touchE && !touchW) x = start.x + (start.w - w) / 2;
    }
  }

  return clampImageEditorCropRect({ x, y, w, h }, maxW, maxH);
}

export function moveImageEditorCropRect(
  start: ImageEditorCropRect,
  dx: number,
  dy: number,
  maxW: number,
  maxH: number,
): ImageEditorCropRect {
  return clampImageEditorCropRect(
    { x: start.x + dx, y: start.y + dy, w: start.w, h: start.h },
    maxW,
    maxH,
  );
}

export function mapCropRectToStage(
  crop: ImageEditorCropRect,
  naturalW: number,
  naturalH: number,
  stageW: number,
  stageH: number,
): { left: number; top: number; width: number; height: number; scale: number } {
  const scale = Math.min(stageW / Math.max(1, naturalW), stageH / Math.max(1, naturalH));
  const imgW = naturalW * scale;
  const imgH = naturalH * scale;
  const imgLeft = (stageW - imgW) / 2;
  const imgTop = (stageH - imgH) / 2;
  return {
    left: imgLeft + crop.x * scale,
    top: imgTop + crop.y * scale,
    width: Math.max(8, crop.w * scale),
    height: Math.max(8, crop.h * scale),
    scale,
  };
}
