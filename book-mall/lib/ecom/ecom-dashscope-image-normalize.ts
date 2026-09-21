import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

/** 百炼生图 / 试衣 · 输入图边长：最短 >150，最长 <4096 */
export const DASHSCOPE_IMAGE_MIN_SIDE = 151;
export const DASHSCOPE_IMAGE_MAX_SIDE = 4095;
/** wan2.6/2.7 多图参考：宽高均须 ≥240（Gateway/百炼校验，与 KIE 无关） */
export const WAN27_MULTI_REF_MIN_SIDE = 240;
/** 百炼 wan2.7 多图参考：高/宽须在 0.12～8.0 */
export const WAN27_MULTI_REF_MIN_HW_RATIO = 0.12;
export const WAN27_MULTI_REF_MAX_HW_RATIO = 8;

function clampWan27RefAspect(
  targetW: number,
  targetH: number,
): { width: number; height: number } {
  let w = Math.max(WAN27_MULTI_REF_MIN_SIDE, targetW);
  let h = Math.max(WAN27_MULTI_REF_MIN_SIDE, targetH);
  let ratio = h / w;
  if (ratio > WAN27_MULTI_REF_MAX_HW_RATIO) {
    w = Math.ceil(h / WAN27_MULTI_REF_MAX_HW_RATIO);
  }
  ratio = h / w;
  if (ratio < WAN27_MULTI_REF_MIN_HW_RATIO) {
    h = Math.ceil(w / WAN27_MULTI_REF_MIN_HW_RATIO);
  }
  return {
    width: Math.max(WAN27_MULTI_REF_MIN_SIDE, w),
    height: Math.max(WAN27_MULTI_REF_MIN_SIDE, h),
  };
}

export function resolveWan27MultiRefTargetDimensions(
  w: number,
  h: number,
): { width: number; height: number } {
  let targetW = w;
  let targetH = h;
  if (targetW < WAN27_MULTI_REF_MIN_SIDE || targetH < WAN27_MULTI_REF_MIN_SIDE) {
    const scale = Math.max(
      WAN27_MULTI_REF_MIN_SIDE / targetW,
      WAN27_MULTI_REF_MIN_SIDE / targetH,
    );
    targetW = Math.ceil(targetW * scale);
    targetH = Math.ceil(targetH * scale);
  }
  let clamped = clampWan27RefAspect(targetW, targetH);
  targetW = clamped.width;
  targetH = clamped.height;

  const maxDim = Math.max(targetW, targetH);
  if (maxDim >= DASHSCOPE_IMAGE_MAX_SIDE) {
    const shrink = (DASHSCOPE_IMAGE_MAX_SIDE - 1) / maxDim;
    targetW = Math.max(
      WAN27_MULTI_REF_MIN_SIDE,
      Math.ceil(targetW * shrink),
    );
    targetH = Math.max(
      WAN27_MULTI_REF_MIN_SIDE,
      Math.ceil(targetH * shrink),
    );
    clamped = clampWan27RefAspect(targetW, targetH);
    targetW = clamped.width;
    targetH = clamped.height;
  }
  return { width: targetW, height: targetH };
}
export const DASHSCOPE_IMAGE_MIN_BYTES = 5 * 1024;
export const DASHSCOPE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

async function downloadImageBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`下载图片失败 HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function resolveDashscopeTargetDimensions(
  w: number,
  h: number,
): { width: number; height: number } {
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
  return { width: targetW, height: targetH };
}

export function wan27ReferenceNeedsPrepare(
  w: number,
  h: number,
  byteLength?: number,
): boolean {
  if (!w || !h) return true;
  const hw = h / w;
  if (w < WAN27_MULTI_REF_MIN_SIDE || h < WAN27_MULTI_REF_MIN_SIDE) return true;
  if (hw < WAN27_MULTI_REF_MIN_HW_RATIO || hw > WAN27_MULTI_REF_MAX_HW_RATIO) {
    return true;
  }
  if (Math.max(w, h) >= DASHSCOPE_IMAGE_MAX_SIDE) return true;
  if (byteLength != null) {
    if (byteLength > DASHSCOPE_IMAGE_MAX_BYTES) return true;
    if (byteLength < DASHSCOPE_IMAGE_MIN_BYTES) return true;
  }
  return false;
}

/** 详情长图等：扩画布满足 H/W、压 JPEG，必要时整体缩小直至 ≤5MB */
export async function prepareWan27ReferenceBuffer(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf, { failOn: "none" }).rotate().metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error("无法读取图片尺寸");
  }
  let { width: canvasW, height: canvasH } = resolveWan27MultiRefTargetDimensions(w, h);

  for (let dimPass = 0; dimPass < 10; dimPass++) {
    let quality = 90;
    for (let qPass = 0; qPass < 7; qPass++) {
      const out = await sharp(buf, { failOn: "none" })
        .rotate()
        .resize(canvasW, canvasH, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255 },
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (
        out.length >= DASHSCOPE_IMAGE_MIN_BYTES &&
        out.length <= DASHSCOPE_IMAGE_MAX_BYTES
      ) {
        return out;
      }
      if (out.length < DASHSCOPE_IMAGE_MIN_BYTES) {
        quality = Math.min(100, quality + 5);
        continue;
      }
      quality = Math.max(48, quality - 10);
    }
    const shrink = 0.88;
    canvasW = Math.max(
      WAN27_MULTI_REF_MIN_SIDE,
      Math.floor(canvasW * shrink),
    );
    canvasH = Math.max(
      WAN27_MULTI_REF_MIN_SIDE,
      Math.floor(canvasH * shrink),
    );
    const reclamped = resolveWan27MultiRefTargetDimensions(canvasW, canvasH);
    canvasW = reclamped.width;
    canvasH = reclamped.height;
  }

  throw new Error(
    "详情长图压缩后仍超过生图接口上限（5MB），请换用更短的长图或降低分辨率后重试",
  );
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

  const { width: targetW, height: targetH } = resolveDashscopeTargetDimensions(w, h);

  const out = await encodeDashscopeImage(input, targetW, targetH);
  const url = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "jpg",
    buf: out,
    contentType: "image/jpeg",
  });
  return { url, normalized: true };
}

/**
 * wan2.6-image / wan2.7-image / wan2.7-image-pro 垫图下发前规范化。
 * 与纯试衣 aitryon 的 151 短边规则不同：多图参考须宽高均 ≥240。
 */
export async function ensureWan27MultiRefImageUrl(opts: {
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

  if (!wan27ReferenceNeedsPrepare(w, h, input.length)) {
    return { url: imageUrl, normalized: false };
  }

  const out = await prepareWan27ReferenceBuffer(input);
  const url = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "jpg",
    buf: out,
    contentType: "image/jpeg",
  });
  return { url, normalized: true };
}

export async function ensureWan27MultiRefImageUrls(opts: {
  userId: string;
  urls: string[];
}): Promise<string[]> {
  const out: string[] = [];
  for (const url of opts.urls) {
    const row = await ensureWan27MultiRefImageUrl({ userId: opts.userId, imageUrl: url });
    out.push(row.url);
  }
  return out;
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

/**
 * aitryon-refiner 要求 person_image 与 coarse_image 宽高完全一致。
 * 以试衣成片（coarse）尺寸为基准，将模特图缩放到相同分辨率后再上传。
 */
export async function ensureAitryonRefinerAlignedUrls(opts: {
  userId: string;
  personImageUrl: string;
  coarseImageUrl: string;
}): Promise<{ personImageUrl: string; coarseImageUrl: string }> {
  const coarseRaw = opts.coarseImageUrl.trim();
  const personRaw = opts.personImageUrl.trim();
  if (!coarseRaw) throw new Error("缺少试衣成片");
  if (!personRaw) throw new Error("缺少模特图");

  const coarseBuf = await downloadImageBuffer(coarseRaw);
  const coarseMeta = await sharp(coarseBuf).metadata();
  const cw = coarseMeta.width ?? 0;
  const ch = coarseMeta.height ?? 0;
  if (!cw || !ch) throw new Error("无法读取试衣成片尺寸");

  const { width: targetW, height: targetH } = resolveDashscopeTargetDimensions(cw, ch);
  const personBuf = await downloadImageBuffer(personRaw);

  const [coarseOut, personOut] = await Promise.all([
    encodeDashscopeImage(coarseBuf, targetW, targetH),
    encodeDashscopeImage(personBuf, targetW, targetH),
  ]);

  const [coarseImageUrl, personImageUrl] = await Promise.all([
    uploadCanvasUserBuffer({
      userId: opts.userId,
      ext: "jpg",
      buf: coarseOut,
      contentType: "image/jpeg",
    }),
    uploadCanvasUserBuffer({
      userId: opts.userId,
      ext: "jpg",
      buf: personOut,
      contentType: "image/jpeg",
    }),
  ]);

  return { personImageUrl, coarseImageUrl };
}
