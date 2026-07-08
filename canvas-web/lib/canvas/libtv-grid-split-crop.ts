"use client";

import type { CSSProperties } from "react";

export type GridSplitCrop = {
  sourceNodeId: string;
  cols: number;
  rows: number;
  col: number;
  row: number;
};

export function gridSplitCropRegion(crop: GridSplitCrop): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return {
    x: crop.col / crop.cols,
    y: crop.row / crop.rows,
    w: 1 / crop.cols,
    h: 1 / crop.rows,
  };
}

async function loadImageForCrop(
  url: string,
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    }
  } catch {
    /* fallback */
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = () =>
      reject(new Error("无法读取图片（可能被跨域拦截），请稍后重试。"));
    img.src = url;
  });
}

function cropRegionToBlob(
  source: CanvasImageSource,
  imgW: number,
  imgH: number,
  region: { x: number; y: number; w: number; h: number },
): Promise<Blob> {
  const sx = Math.max(0, Math.round(region.x * imgW));
  const sy = Math.max(0, Math.round(region.y * imgH));
  const sw = Math.min(imgW - sx, Math.max(1, Math.round(region.w * imgW)));
  const sh = Math.min(imgH - sy, Math.max(1, Math.round(region.h * imgH)));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas 不可用"));
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("裁切导出失败"))),
      "image/jpeg",
      0.92,
    );
  });
}

/** 宫格单元 · 裁切为 blob URL（各镜/扩图独立缩略图） */
export async function cropGridSplitCellToBlobUrl(
  url: string,
  crop: GridSplitCrop,
): Promise<string> {
  const result = await cropGridSplitCell(url, crop);
  return result.blobUrl;
}

export type GridSplitCroppedCell = {
  blobUrl: string;
  cellWidth: number;
  cellHeight: number;
};

/** 宫格单元 · canvas 真实裁切 + 单元像素尺寸（用于节点自适应） */
export async function cropGridSplitCell(
  url: string,
  crop: GridSplitCrop,
): Promise<GridSplitCroppedCell> {
  const { source, width, height } = await loadImageForCrop(url);
  const region = gridSplitCropRegion(crop);
  const cellWidth = Math.max(1, Math.round(region.w * width));
  const cellHeight = Math.max(1, Math.round(region.h * height));
  const blob = await cropRegionToBlob(
    source,
    width,
    height,
    region,
  );
  return {
    blobUrl: URL.createObjectURL(blob),
    cellWidth,
    cellHeight,
  };
}

/** 宫格单元 · background-image sprite 裁切（不依赖 <img> 定位，稳定可靠） */
export function gridSplitCropBackgroundStyle(
  url: string,
  crop: GridSplitCrop,
): CSSProperties {
  const { cols, rows, col, row } = crop;
  // background-position 百分比：将图片 P% 点对齐容器 P% 点，正好逐格取样
  const posX = cols > 1 ? (col / (cols - 1)) * 100 : 0;
  const posY = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return {
    backgroundImage: `url("${url}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  };
}
