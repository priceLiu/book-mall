export type ImageEditorFrameResizeHandleId = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** 画布像素里的图片位置。offset 是相对居中的位移，正值向右、向下。 */
export function placeImageInCanvas(opts: {
  canvasW: number;
  canvasH: number;
  imageW: number;
  imageH: number;
  fitInside: boolean;
  offsetX?: number;
  offsetY?: number;
}): { x: number; y: number; w: number; h: number; offsetX: number; offsetY: number } {
  const canvasW = Math.max(1, opts.canvasW);
  const canvasH = Math.max(1, opts.canvasH);
  const imageW = Math.max(1, opts.imageW);
  const imageH = Math.max(1, opts.imageH);
  const scale = opts.fitInside
    ? Math.min(canvasW / imageW, canvasH / imageH)
    : Math.max(canvasW / imageW, canvasH / imageH);
  const w = imageW * scale;
  const h = imageH * scale;
  const limitX = Math.max(0, Math.abs(canvasW - w) / 2);
  const limitY = Math.max(0, Math.abs(canvasH - h) / 2);
  const offsetX = Math.min(limitX, Math.max(-limitX, opts.offsetX ?? 0));
  const offsetY = Math.min(limitY, Math.max(-limitY, opts.offsetY ?? 0));
  return {
    x: (canvasW - w) / 2 + offsetX,
    y: (canvasH - h) / 2 + offsetY,
    w,
    h,
    offsetX,
    offsetY,
  };
}

export function frameScaleFromElement(
  frame: Element | null,
  canvasWidth: number,
  canvasHeight: number,
): { sx: number; sy: number } {
  if (!frame) return { sx: 1, sy: 1 };
  const rect = frame.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { sx: 1, sy: 1 };
  return { sx: canvasWidth / rect.width, sy: canvasHeight / rect.height };
}

/**
 * 画布裁切（设计室式）：
 * 1. 中栏框 = 输出画布比例；拖 8 点 → 更新 `canvasW` / `canvasH`（右栏同步）
 * 2. 预览：`renderImageEditorFrame` 按输出尺寸重绘（尺寸/比例 Tab）；形状 Tab 仅改框+蒙版，点确定再 clip
 * 3. 应用：`exportImageEditorFrame` 写入当前图；`fitInside` 由「无损改尺寸」决定裁切还是容纳
 */
export function computeCanvasSizeFromHandleDrag(
  handle: ImageEditorFrameResizeHandleId,
  startW: number,
  startH: number,
  dx: number,
  dy: number,
  lockAspect: boolean,
): { width: number; height: number } {
  const aspect = startW / Math.max(1, startH);
  let nextW = startW;
  let nextH = startH;

  if (lockAspect) {
    switch (handle) {
      case "e":
        nextW = startW + dx;
        nextH = nextW / aspect;
        break;
      case "w":
        nextW = startW - dx;
        nextH = nextW / aspect;
        break;
      case "s":
        nextH = startH + dy;
        nextW = nextH * aspect;
        break;
      case "n":
        nextH = startH - dy;
        nextW = nextH * aspect;
        break;
      case "se":
      case "ne":
      case "sw":
      case "nw":
        nextW = startW + (handle === "se" || handle === "ne" ? dx : -dx);
        nextH = nextW / aspect;
        break;
      default:
        break;
    }
  } else {
    switch (handle) {
      case "e":
        nextW = startW + dx;
        break;
      case "w":
        nextW = startW - dx;
        break;
      case "s":
        nextH = startH + dy;
        break;
      case "n":
        nextH = startH - dy;
        break;
      case "se":
        nextW = startW + dx;
        nextH = startH + dy;
        break;
      case "nw":
        nextW = startW - dx;
        nextH = startH - dy;
        break;
      case "ne":
        nextW = startW + dx;
        nextH = startH - dy;
        break;
      case "sw":
        nextW = startW - dx;
        nextH = startH + dy;
        break;
      default:
        break;
    }
  }

  return {
    width: Math.min(8192, Math.max(64, Math.round(nextW))),
    height: Math.min(8192, Math.max(64, Math.round(nextH))),
  };
}