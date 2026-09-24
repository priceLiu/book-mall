import type { CSSProperties } from "react";

import type { ImageLayerStackItem } from "@/lib/image-layer-types";

/** 与画布 CSS（max-w-full + h-auto）一致：整图层按画布宽度等比缩放 */
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
  /** full-frame：与底图同宽；bbox-crop：按框贴回，避免小图被拉满画布 */
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

/** 物体层 PNG 明显小于画布时，是裁切块，不能按整图拉满 */
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

  if (
    !layer.isBackground &&
    isBboxCropLayer(naturalWidth, naturalHeight, canvasWidth, canvasHeight)
  ) {
    if (bbox) {
      const rect = normalizedBboxRect(bbox, canvasWidth, canvasHeight);
      return {
        x: rect.x + userDx,
        y: rect.y + userDy,
        width: rect.width,
        height: rect.height,
        mode: "bbox-crop",
      };
    }
    return {
      x: userDx,
      y: userDy,
      width: naturalWidth,
      height: naturalHeight,
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

/** 物体层初始 display 偏移：裁切块才需要按 bbox 落位 */
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

/** 画布 DOM：整图层铺满；裁切块按 bbox 百分比贴回 */
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
  if (
    !layer.isBackground &&
    isBboxCropLayer(naturalWidth, naturalHeight, canvasWidth, canvasHeight)
  ) {
    if (bbox) {
      return {
        className: "absolute select-none object-contain",
        style: {
          left: `${(bbox[0] / 1000) * 100}%`,
          top: `${(bbox[1] / 1000) * 100}%`,
          width: `${((bbox[2] - bbox[0]) / 1000) * 100}%`,
          height: `${((bbox[3] - bbox[1]) / 1000) * 100}%`,
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        },
      };
    }
    if (canvasWidth > 0 && canvasHeight > 0) {
      return {
        className: "absolute select-none object-contain",
        style: {
          left: 0,
          top: 0,
          width: `${(naturalWidth / canvasWidth) * 100}%`,
          height: `${(naturalHeight / canvasHeight) * 100}%`,
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        },
      };
    }
  }

  return {
    className: "absolute left-0 top-0 h-auto max-w-full select-none",
    style: {
      transform: `translate(${offsetX}px, ${offsetY}px)`,
    },
  };
}
