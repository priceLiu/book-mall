import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { DASHSCOPE_IMAGE_MIN_SIDE } from "@/lib/ecom/ecom-dashscope-image-normalize";

const BBOX_PAD_RATIO = 0.02;
/** 裁切后面积缩小超过此比例则视为「有明显留白」 */
const TRIM_AREA_SHRINK_RATIO = 0.03;

async function downloadImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`下载服装图失败 HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export function clampBboxExtractRect(
  imageWidth: number,
  imageHeight: number,
  bbox: number[],
): { left: number; top: number; width: number; height: number } | null {
  if (bbox.length < 4) return null;
  const [x1, y1, x2, y2] = bbox.map((n) => Number(n));
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;

  let left = Math.max(0, Math.floor(Math.min(x1, x2)));
  let top = Math.max(0, Math.floor(Math.min(y1, y2)));
  let right = Math.min(imageWidth, Math.ceil(Math.max(x1, x2)));
  let bottom = Math.min(imageHeight, Math.ceil(Math.max(y1, y2)));
  let width = right - left;
  let height = bottom - top;
  if (width < 8 || height < 8) return null;

  const padX = Math.round(width * BBOX_PAD_RATIO);
  const padY = Math.round(height * BBOX_PAD_RATIO);
  left = Math.max(0, left - padX);
  top = Math.max(0, top - padY);
  right = Math.min(imageWidth, right + padX);
  bottom = Math.min(imageHeight, bottom + padY);
  width = right - left;
  height = bottom - top;
  if (width < 8 || height < 8) return null;

  return { left, top, width, height };
}

/** 统计非近白像素占比，用于判断 crop 是否留白过多 */
export async function estimateGarmentContentFillRatio(buf: Buffer): Promise<number> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height || channels < 3) return 0;

  let content = 0;
  const total = width * height;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r < 245 || g < 245 || b < 245) content++;
  }
  return content / total;
}

function isNearWhitePixel(data: Buffer, offset: number, channels: number): boolean {
  const r = data[offset]!;
  const g = data[offset + 1]!;
  const b = data[offset + 2]!;
  return r >= 245 && g >= 245 && b >= 245;
}

/** 按非近白像素外接矩形裁切，比 sharp.trim 更稳（分割 crop 常带大块纯白底） */
export async function contentAwareTrimGarmentCropBuffer(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height || channels < 3) return buf;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      if (!isNearWhitePixel(data, offset, channels)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) return buf;

  const pad = 2;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  if (cropWidth < 8 || cropHeight < 8) return buf;

  return sharp(buf)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();
}

export async function tightTrimGarmentCropBuffer(buf: Buffer): Promise<Buffer> {
  return contentAwareTrimGarmentCropBuffer(buf);
}

async function upscaleGarmentCropIfTooSmall(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 1 || h < 1) return buf;
  const minEdge = Math.min(w, h);
  if (minEdge >= DASHSCOPE_IMAGE_MIN_SIDE) return buf;
  const scale = DASHSCOPE_IMAGE_MIN_SIDE / minEdge;
  return sharp(buf)
    .resize(Math.round(w * scale), Math.round(h * scale), { fit: "fill" })
    .png()
    .toBuffer();
}

async function buildGarmentCropCandidates(opts: {
  vendorCropUrl: string;
  bbox?: number[] | null;
  sourceImageUrl?: string;
}): Promise<Buffer[]> {
  const candidates: Buffer[] = [];
  const vendorBuf = await downloadImageBuffer(opts.vendorCropUrl);
  candidates.push(await tightTrimGarmentCropBuffer(vendorBuf));

  const sourceUrl = opts.sourceImageUrl?.trim();
  const bbox = opts.bbox;
  if (sourceUrl && bbox && bbox.length >= 4) {
    const sourceBuf = await downloadImageBuffer(sourceUrl);
    const meta = await sharp(sourceBuf).metadata();
    const rect = clampBboxExtractRect(meta.width ?? 0, meta.height ?? 0, bbox);
    if (rect) {
      const extracted = await sharp(sourceBuf).extract(rect).png().toBuffer();
      candidates.push(await tightTrimGarmentCropBuffer(extracted));
    }
  }

  return candidates;
}

/** 在 vendor crop / bbox 候选里选内容占比最高的 tight crop */
export async function pickBestGarmentCropBuffer(
  candidates: Buffer[],
): Promise<{ buf: Buffer; fillRatio: number }> {
  let best = candidates[0]!;
  let bestFill = await estimateGarmentContentFillRatio(best);
  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    const fill = await estimateGarmentContentFillRatio(candidate);
    if (fill > bestFill) {
      best = candidate;
      bestFill = fill;
    }
  }
  return { buf: best, fillRatio: bestFill };
}

/**
 * 分割后持久化服装 crop：裁掉近白边，必要时按 bbox 从原图重裁，再上传 OSS。
 */
export async function normalizeVtonGarmentCropUrl(opts: {
  userId: string;
  vendorCropUrl: string;
  bbox?: number[] | null;
  sourceImageUrl?: string;
}): Promise<string> {
  const vendorCropUrl = opts.vendorCropUrl.trim();
  if (!vendorCropUrl) throw new Error("缺少服装分割图");

  const candidates = await buildGarmentCropCandidates(opts);
  const { buf, fillRatio } = await pickBestGarmentCropBuffer(candidates);
  if (fillRatio < 0.08) {
    throw new Error("上装/下装分割结果留白过多，请换一张上下装完整、背景简洁的参考图");
  }

  const normalized = await upscaleGarmentCropIfTooSmall(buf);
  return uploadCanvasUserBuffer({
    userId: opts.userId,
    buf: normalized,
    contentType: "image/png",
    ext: "png",
    preferBucketUrl: true,
  });
}

export type VtonGarmentCropQuality = {
  width: number;
  height: number;
  fillRatio: number;
  /** 内容外接矩形高度 / 画布高度；越低说明纵向留白越多 */
  contentHeightRatio: number;
  needsTightening: boolean;
};

/** 评估服装 crop 是否留白过多（用于排查「有的套成功、有的失败」） */
export async function assessVtonGarmentCropQuality(buf: Buffer): Promise<VtonGarmentCropQuality> {
  const meta = await sharp(buf).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const fillRatio = await estimateGarmentContentFillRatio(buf);

  const trimmed = await contentAwareTrimGarmentCropBuffer(buf);
  const trimmedMeta = await sharp(trimmed).metadata();
  const contentHeight = trimmedMeta.height ?? height;
  const contentHeightRatio = height > 0 ? contentHeight / height : 1;

  const areaBefore = width * height;
  const areaAfter = (trimmedMeta.width ?? width) * contentHeight;
  const areaShrink =
    areaBefore > 0 ? Math.max(0, 1 - areaAfter / areaBefore) : 0;

  const needsTightening =
    areaShrink >= TRIM_AREA_SHRINK_RATIO ||
    (contentHeightRatio < 0.82 && fillRatio < 0.58) ||
    fillRatio < 0.28;

  return {
    width,
    height,
    fillRatio,
    contentHeightRatio,
    needsTightening,
  };
}

/**
 * 试衣前对已持久化的服装 URL 做二次收紧（修复历史分割图留白过多）。
 * 按裁切前后面积/内容高度判断，避免「fill 刚好 >35% 但下面仍有大块白底」漏网。
 */
export async function assessVtonGarmentUrlQuality(
  garmentUrl: string,
): Promise<VtonGarmentCropQuality> {
  const buf = await downloadImageBuffer(garmentUrl.trim());
  return assessVtonGarmentCropQuality(buf);
}

export async function tightenVtonGarmentUrlIfNeeded(opts: {
  userId: string;
  garmentUrl: string;
}): Promise<string> {
  const garmentUrl = opts.garmentUrl.trim();
  if (!garmentUrl) throw new Error("缺少服装参考图");

  const original = await downloadImageBuffer(garmentUrl);
  const quality = await assessVtonGarmentCropQuality(original);
  if (!quality.needsTightening) return garmentUrl;

  const trimmed = await tightTrimGarmentCropBuffer(original);
  const fillAfter = await estimateGarmentContentFillRatio(trimmed);
  if (fillAfter < 0.08) return garmentUrl;

  const normalized = await upscaleGarmentCropIfTooSmall(trimmed);
  return uploadCanvasUserBuffer({
    userId: opts.userId,
    buf: normalized,
    contentType: "image/png",
    ext: "png",
    preferBucketUrl: true,
  });
}
