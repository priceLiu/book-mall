import sharp from "sharp";

import type { LocalEditBbox } from "./types";

function clampRect(
  bbox: LocalEditBbox,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const x1 = Math.round(Math.max(0, Math.min(bbox[0], bbox[2])));
  const y1 = Math.round(Math.max(0, Math.min(bbox[1], bbox[3])));
  const x2 = Math.round(Math.min(width, Math.max(bbox[0], bbox[2])));
  const y2 = Math.round(Math.min(height, Math.max(bbox[1], bbox[3])));
  return {
    x: x1,
    y: y1,
    w: Math.max(1, x2 - x1),
    h: Math.max(1, y2 - y1),
  };
}

/** 原图像素 bbox → 黑白 PNG 蒙版 data URL（白=擦除区） */
export async function bboxToMaskPngDataUrl(
  bbox: LocalEditBbox,
  width: number,
  height: number,
): Promise<string> {
  if (width <= 0 || height <= 0) {
    throw new Error("无法根据框选生成蒙版：底图尺寸无效");
  }
  const { x, y, w, h } = clampRect(bbox, width, height);
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#000"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  if (!buf?.byteLength) {
    throw new Error("无法根据框选生成蒙版");
  }
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/** 0～999 归一化多框 → 黑白 PNG 蒙版（白=擦除区） */
export async function normalizedBboxesToMaskPngDataUrl(
  bboxes: Array<[number, number, number, number]>,
  width: number,
  height: number,
): Promise<string> {
  if (width <= 0 || height <= 0) {
    throw new Error("无法根据框选生成蒙版：底图尺寸无效");
  }
  if (bboxes.length === 0) {
    throw new Error("缺少擦除区域");
  }
  const rects = bboxes.map(([x1, y1, x2, y2]) => {
    const left = Math.round((Math.min(x1, x2) / 1000) * width);
    const top = Math.round((Math.min(y1, y2) / 1000) * height);
    const right = Math.round((Math.max(x1, x2) / 1000) * width);
    const bottom = Math.round((Math.max(y1, y2) / 1000) * height);
    return {
      x: Math.max(0, left),
      y: Math.max(0, top),
      w: Math.max(1, Math.min(width, right) - Math.max(0, left)),
      h: Math.max(1, Math.min(height, bottom) - Math.max(0, top)),
    };
  });
  const svgRects = rects
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#fff"/>`)
    .join("");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#000"/>${svgRects}</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  if (!buf?.byteLength) {
    throw new Error("无法根据框选生成蒙版");
  }
  return `data:image/png;base64,${buf.toString("base64")}`;
}
