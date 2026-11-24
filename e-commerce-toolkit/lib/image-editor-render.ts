import { clipPathForImageEditorShape, clipPathForImageEditorShapeMeet } from "@/lib/image-editor-shape-mask";
import type { ImageEditorTransform } from "@/lib/image-editor-transform";

export type RenderImageEditorOptions = ImageEditorTransform & {
  /** 预览最大边长，减小 dataURL 体积 */
  previewMaxEdge?: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

export async function renderImageEditorFrame(
  src: string,
  opts: RenderImageEditorOptions,
): Promise<string> {
  const img = await loadImage(src);
  let outW = Math.max(1, Math.round(opts.canvasW));
  let outH = Math.max(1, Math.round(opts.canvasH));

  if (opts.previewMaxEdge) {
    const maxEdge = Math.max(outW, outH);
    if (maxEdge > opts.previewMaxEdge) {
      const s = opts.previewMaxEdge / maxEdge;
      outW = Math.max(1, Math.round(outW * s));
      outH = Math.max(1, Math.round(outH * s));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  ctx.clearRect(0, 0, outW, outH);
  ctx.save();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  const mask = opts.shapeMask ?? "none";
  if (mask !== "none") {
    clipPathForImageEditorShape(ctx, outW, outH, mask);
  }

  if (opts.filterStyle) {
    ctx.filter = opts.filterStyle;
  }

  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((opts.rotateDeg * Math.PI) / 180);
  const scaleX = opts.flipH ? -1 : 1;
  const scaleY = opts.flipV ? -1 : 1;
  ctx.scale(scaleX, scaleY);

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = opts.fitInside
    ? Math.min(outW / iw, outH / ih)
    : Math.max(outW / iw, outH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

/** 裁切窗口像素 1:1 画出，形状按预览 meet 裁切（与中栏亮区一致） */
export async function renderImageEditorCropRegion(
  src: string,
  crop: { x: number; y: number; w: number; h: number },
  previewMaxEdge = 1600,
  shapeMask: ImageEditorTransform["shapeMask"] = "none",
): Promise<string> {
  const img = await loadImage(src);
  const srcW = Math.max(1, crop.w);
  const srcH = Math.max(1, crop.h);
  let outW = Math.max(1, Math.round(srcW));
  let outH = Math.max(1, Math.round(srcH));
  const maxEdge = Math.max(outW, outH);
  let scaleOut = 1;
  if (maxEdge > previewMaxEdge) {
    scaleOut = previewMaxEdge / maxEdge;
    outW = Math.max(1, Math.round(outW * scaleOut));
    outH = Math.max(1, Math.round(outH * scaleOut));
  }
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.save();
  if (shapeMask && shapeMask !== "none") {
    clipPathForImageEditorShapeMeet(ctx, outW, outH, shapeMask);
  }
  ctx.drawImage(img, crop.x, crop.y, srcW, srcH, 0, 0, outW, outH);
  ctx.restore();
  return canvas.toDataURL("image/png");
}

export async function exportImageEditorFrame(
  src: string,
  opts: ImageEditorTransform,
): Promise<string> {
  return renderImageEditorFrame(src, opts);
}