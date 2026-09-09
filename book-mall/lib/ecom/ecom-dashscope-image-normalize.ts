import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

/** 百炼生图 / 试衣 · 输入图边长：最短 >150，最长 <4096 */
export const DASHSCOPE_IMAGE_MIN_SIDE = 151;
export const DASHSCOPE_IMAGE_MAX_SIDE = 4095;
export const DASHSCOPE_IMAGE_MIN_BYTES = 5 * 1024;
export const DASHSCOPE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

async function downloadImageBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`下载图片失败 HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function encodeDashscopeImage(buf: Buffer, w: number, h: number): Promise<Buffer> {
  let quality = 92;
  for (let attempt = 0; attempt < 6; attempt++) {
    const out = await sharp(buf)
      .resize(w, h, { fit: "fill" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length >= DASHSCOPE_IMAGE_MIN_BYTES && out.length <= DASHSCOPE_IMAGE_MAX_BYTES) {
      return out;
    }
    if (out.length < DASHSCOPE_IMAGE_MIN_BYTES) {
      quality = Math.min(100, quality + 4);
      continue;
    }
    quality = Math.max(55, quality - 12);
  }
  const fallback = await sharp(buf)
    .resize(w, h, { fit: "fill" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  if (fallback.length > DASHSCOPE_IMAGE_MAX_BYTES) {
    throw new Error("图片体积超过 5MB，请换用更小尺寸的参考图");
  }
  if (fallback.length < DASHSCOPE_IMAGE_MIN_BYTES) {
    throw new Error("图片过小或内容过于简单，请换用更高清的参考图");
  }
  return fallback;
}

/**
 * 规范化 DashScope 生图 / 试衣输入图：
 * 边长 151～4095px，文件 5KB～5MB。
 */
export async function ensureDashscopeImageUrl(opts: {
  userId: string;
  imageUrl: string;
}): Promise<{ url: string; normalized: boolean }> {
  const imageUrl = opts.imageUrl.trim();
  const input = await downloadImageBuffer(imageUrl);
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error("无法读取图片尺寸");
  }

  const withinSide =
    Math.min(w, h) > DASHSCOPE_IMAGE_MIN_SIDE - 1 &&
    Math.max(w, h) < DASHSCOPE_IMAGE_MAX_SIDE + 1;
  const withinBytes =
    input.length >= DASHSCOPE_IMAGE_MIN_BYTES &&
    input.length <= DASHSCOPE_IMAGE_MAX_BYTES;

  if (withinSide && withinBytes) {
    return { url: imageUrl, normalized: false };
  }

  let targetW = w;
  let targetH = h;
  if (Math.min(w, h) < DASHSCOPE_IMAGE_MIN_SIDE) {
    const scale = DASHSCOPE_IMAGE_MIN_SIDE / Math.min(w, h);
    targetW = Math.ceil(w * scale);
    targetH = Math.ceil(h * scale);
  }
  const maxDim = Math.max(targetW, targetH);
  if (maxDim >= DASHSCOPE_IMAGE_MAX_SIDE) {
    const shrink = (DASHSCOPE_IMAGE_MAX_SIDE - 1) / maxDim;
    targetW = Math.max(DASHSCOPE_IMAGE_MIN_SIDE, Math.floor(targetW * shrink));
    targetH = Math.max(DASHSCOPE_IMAGE_MIN_SIDE, Math.floor(targetH * shrink));
  }

  const out = await encodeDashscopeImage(input, targetW, targetH);
  const url = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "jpg",
    buf: out,
    contentType: "image/jpeg",
  });
  return { url, normalized: true };
}

export async function ensureDashscopeImageUrls(opts: {
  userId: string;
  urls: string[];
}): Promise<string[]> {
  const out: string[] = [];
  for (const url of opts.urls) {
    const row = await ensureDashscopeImageUrl({ userId: opts.userId, imageUrl: url });
    out.push(row.url);
  }
  return out;
}
