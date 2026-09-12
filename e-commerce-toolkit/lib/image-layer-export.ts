import { imageLayerComposeImageSrc } from "@/lib/image-layer-compose-image-src";
import {
  computeLayerDrawSize,
  resolveLayerDrawPlacement,
} from "@/lib/image-layer-placement";
import type { ImageLayerStackItem } from "@/lib/image-layer-types";

export { computeLayerDrawSize } from "@/lib/image-layer-placement";

async function loadImage(url: string): Promise<HTMLImageElement> {
  const fetchUrl = imageLayerComposeImageSrc(url);
  const res = await fetch(fetchUrl, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    throw new Error("加载图层失败");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("加载图层失败"));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function exportLayerStackPng(opts: {
  background: ImageLayerStackItem;
  layers: ImageLayerStackItem[];
  width: number;
  height: number;
  /** 画布显示宽 → 原图像素宽的倍率（拖拽偏移为显示像素时需传入） */
  displayScale?: number;
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(opts.width));
  canvas.height = Math.max(1, Math.round(opts.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 Canvas");

  const scale = opts.displayScale && opts.displayScale > 0 ? opts.displayScale : 1;
  const ordered = [opts.background, ...opts.layers].sort(
    (a, b) => a.zIndex - b.zIndex,
  );

  for (const layer of ordered) {
    const img = await loadImage(layer.url);
    const placement = resolveLayerDrawPlacement({
      layer,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      displayScale: scale,
    });
    ctx.drawImage(
      img,
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    );
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("导出 PNG 失败");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
