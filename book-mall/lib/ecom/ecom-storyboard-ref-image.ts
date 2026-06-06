import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

/** 分镜垫图 / 可灵：短边 ≥300px */
const KLING_REF_MIN_SIDE = 300;
const KLING_REF_MAX_SIDE = 4096;

/** KIE Seedance 等视频参考图：240～8000px */
const VIDEO_REF_MIN_SIDE = 240;
const VIDEO_REF_MAX_SIDE = 8000;

/** 百炼 wan2.6 / wan2.7 R2V：宽高均须 ≥300（API 校验） */
const BAILIAN_R2V_WAN_MIN_SIDE = 300;

/** 百炼 HappyHorse R2V：短边 ≥400（官方文档） */
const BAILIAN_R2V_HAPPYHORSE_MIN_SIDE = 400;

export function bailianR2vRefMinSide(modelKey: string): number {
  if (modelKey.trim() === "happyhorse-1.0-r2v") {
    return BAILIAN_R2V_HAPPYHORSE_MIN_SIDE;
  }
  return BAILIAN_R2V_WAN_MIN_SIDE;
}

async function ensureRefImageInBounds(opts: {
  userId: string;
  imageUrl: string;
  minSide: number;
  maxSide: number;
}): Promise<{ url: string; normalized: boolean }> {
  const imageUrl = opts.imageUrl.trim();
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`下载参考图失败 HTTP ${res.status}`);
  }
  const input = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error("无法读取参考图尺寸");
  }

  const needsUpscale = w < opts.minSide || h < opts.minSide;
  const needsDownscale = w > opts.maxSide || h > opts.maxSide;
  if (!needsUpscale && !needsDownscale) {
    return { url: imageUrl, normalized: false };
  }

  let targetW = w;
  let targetH = h;
  if (needsUpscale) {
    const scale = Math.max(opts.minSide / w, opts.minSide / h);
    targetW = Math.ceil(w * scale);
    targetH = Math.ceil(h * scale);
  }
  const maxDim = Math.max(targetW, targetH);
  if (maxDim > opts.maxSide) {
    const shrink = opts.maxSide / maxDim;
    targetW = Math.max(opts.minSide, Math.floor(targetW * shrink));
    targetH = Math.max(opts.minSide, Math.floor(targetH * shrink));
  }

  const out = await sharp(input)
    .resize(targetW, targetH, { fit: "fill" })
    .png()
    .toBuffer();

  const url = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "png",
    buf: out,
    contentType: "image/png",
  });

  return { url, normalized: true };
}

/**
 * 垫图分辨率不满足厂商校验时，等比缩放并回传 OSS（不修改用户原始参考图记录）。
 * 可灵 / 万相生图：短边 ≥300px。
 */
export async function ensureStoryboardRefImageForWan27(opts: {
  userId: string;
  imageUrl: string;
}): Promise<{ url: string; normalized: boolean }> {
  return ensureRefImageInBounds({
    userId: opts.userId,
    imageUrl: opts.imageUrl,
    minSide: KLING_REF_MIN_SIDE,
    maxSide: KLING_REF_MAX_SIDE,
  });
}

/** 整图成片 / Seedance 等：参考图 240～8000px */
export async function ensureStoryboardVideoRefImage(opts: {
  userId: string;
  imageUrl: string;
}): Promise<{ url: string; normalized: boolean }> {
  return ensureRefImageInBounds({
    userId: opts.userId,
    imageUrl: opts.imageUrl,
    minSide: VIDEO_REF_MIN_SIDE,
    maxSide: VIDEO_REF_MAX_SIDE,
  });
}

/** 百炼 R2V 成片：按模型满足最小边（wan 300px / HappyHorse 400px） */
export async function ensureStoryboardBailianR2vRefImage(opts: {
  userId: string;
  imageUrl: string;
  modelKey: string;
}): Promise<{ url: string; normalized: boolean }> {
  return ensureRefImageInBounds({
    userId: opts.userId,
    imageUrl: opts.imageUrl,
    minSide: bailianR2vRefMinSide(opts.modelKey),
    maxSide: VIDEO_REF_MAX_SIDE,
  });
}

export async function ensureStoryboardRefImagesForWan27(opts: {
  userId: string;
  urls: string[];
}): Promise<string[]> {
  const normalized: string[] = [];
  for (const url of opts.urls) {
    const row = await ensureStoryboardRefImageForWan27({
      userId: opts.userId,
      imageUrl: url,
    });
    normalized.push(row.url);
  }
  return normalized;
}

export async function ensureStoryboardVideoRefImages(opts: {
  userId: string;
  urls: string[];
}): Promise<string[]> {
  const normalized: string[] = [];
  for (const url of opts.urls) {
    const row = await ensureStoryboardVideoRefImage({
      userId: opts.userId,
      imageUrl: url,
    });
    normalized.push(row.url);
  }
  return normalized;
}
