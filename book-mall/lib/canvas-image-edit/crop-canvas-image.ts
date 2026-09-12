import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ensurePublicImageUrl } from "@/lib/image-local-edit/image-url";

const MAX_BYTES = 30 * 1024 * 1024;

export type CanvasImageCropBbox = [number, number, number, number];

function normalizeBbox(
  bbox: CanvasImageCropBbox,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const [x1, y1, x2, y2] = bbox;
  const left = Math.max(0, Math.min(Math.round(x1), Math.round(x2)));
  const top = Math.max(0, Math.min(Math.round(y1), Math.round(y2)));
  const right = Math.min(width, Math.max(Math.round(x1), Math.round(x2)));
  const bottom = Math.min(height, Math.max(Math.round(y1), Math.round(y2)));
  const w = right - left;
  const h = bottom - top;
  if (w < 4 || h < 4) {
    throw new Error("裁剪区域过小");
  }
  return { left, top, width: w, height: h };
}

/** 画布裁剪 · 按原图像素 bbox 裁切并上传 OSS */
export async function cropCanvasImageToOss(opts: {
  userId: string;
  sourceImageUrl: string;
  bbox: CanvasImageCropBbox;
}): Promise<string> {
  const publicUrl = await ensurePublicImageUrl(opts.userId, opts.sourceImageUrl);
  const res = await fetch(publicUrl, { method: "GET" });
  if (!res.ok) {
    throw new Error(`无法下载原图：HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("原图过大，无法裁剪");
  }

  const meta = await sharp(buf).metadata();
  const imgW = meta.width ?? 1;
  const imgH = meta.height ?? 1;
  const region = normalizeBbox(opts.bbox, imgW, imgH);

  const cropped = await sharp(buf)
    .extract(region)
    .png()
    .toBuffer();

  return uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "png",
    buf: cropped,
    contentType: "image/png",
  });
}
