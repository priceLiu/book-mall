import type { CSSProperties } from "react";

import type { ImageLayerStackItem } from "@/lib/image-layer-types";

/** 与画布 CSS（max-w-full + h-auto）一致：统一按画布宽度等比缩放 */
export function computeLayerDrawSize(
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: canvasWidth, height: canvasWidth };
  }
  const width = canvasWidth;
  const height = (naturalHeight / naturalWidth) * width;
  return { width, height };
}

export type LayerDrawPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** full-frame：与底图同宽对齐；bbox-crop：按 bbox 贴回 */
  mode: "full-frame" | "bbox-crop";
};

function normalizedBboxRect(
  bbox: [number, number, number, number],
  canvasWidth: number,
  canvasHeight: number,
) {
  const x1 = (bbox[0] / 1000) * canvasWidth;
  const y1 = (bbox[1] / 1000) * canvasHeight;
  const x2 = (bbox[2] / 1000) * canvasWidth;
  const y2 = (bbox[3] / 1000) * canvasHeight;
  return { x: x1, y: y1, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) };
}

/** 判断物体层 PNG 是否为 bbox 裁剪块（而非整图透明层） */
export function isBboxCropLayer(
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  return (
    naturalWidth < canvasWidth * 0.85 &&
    naturalHeight < canvasHeight * 0.85
  );
}

/** 计算单层在导出 canvas 上的绘制位置（含用户拖拽 offset） */
export function resolveLayerDrawPlacement(opts: {
  layer: ImageLayerStackItem;
  naturalWidth: number;
  naturalHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  displayScale: number;
}): LayerDrawPlacement {
  const {
    layer,
    naturalWidth,
    naturalHeight,
    canvasWidth,
    canvasHeight,
    displayScale,
  } = opts;
  const userDx = (layer.offsetX ?? 0) * displayScale;
  const userDy = (layer.offsetY ?? 0) * displayScale;

  const bbox = layer.bbox?.normalized;
  if (!layer.isBackground && bbox && isBboxCropLayer(naturalWidth, naturalHeight, canvasWidth, canvasHeight)) {
    const rect = normalizedBboxRect(bbox, canvasWidth, canvasHeight);
    return {
      x: rect.x + userDx,
      y: rect.y + userDy,
      width: rect.width,
      height: rect.height,
      mode: "bbox-crop",
    };
  }

  const { width, height } = computeLayerDrawSize(
    naturalWidth,
    naturalHeight,
    canvasWidth,
  );
  return {
    x: userDx,
    y: userDy,
    width,
    height,
    mode: "full-frame",
  };
}

/** 物体层在画布上的初始 display 偏移（bbox 裁剪块才需要，整图层为 0） */
export function initialDisplayOffsetForLayer(
  layer: ImageLayerStackItem,
  displayWidth: number,
  displayHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { offsetX: number; offsetY: number } {
  const bbox = layer.bbox?.normalized;
  if (
    layer.isBackground ||
    !bbox ||
    !isBboxCropLayer(naturalWidth, naturalHeight, canvasWidth, canvasHeight)
  ) {
    return { offsetX: 0, offsetY: 0 };
  }
  return {
    offsetX: (bbox[0] / 1000) * displayWidth,
    offsetY: (bbox[1] / 1000) * displayHeight,
  };
}

/** 画布 DOM 上物体层的定位（整图层 vs bbox 裁剪块） */
export function getLayerCanvasStyle(
  layer: ImageLayerStackItem,
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  offsetX: number,
  offsetY: number,
): {
  className: string;
  style: CSSProperties;
} {
  const bbox = layer.bbox?.normalized;
  const isCrop =
    !layer.isBackground &&
    bbox &&
    isBboxCropLayer(naturalWidth, naturalHeight, canvasWidth, canvasHeight);

  if (isCrop && bbox) {
    return {
      className: "absolute select-none",
      style: {
        left: `${(bbox[0] / 1000) * 100}%`,
        top: `${(bbox[1] / 1000) * 100}%`,
        width: `${((bbox[2] - bbox[0]) / 1000) * 100}%`,
        height: "auto",
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      },
    };
  }

  return {
    className: "absolute left-0 top-0 h-auto max-w-full select-none",
    style: {
      transform: `translate(${offsetX}px, ${offsetY}px)`,
    },
  };
}
