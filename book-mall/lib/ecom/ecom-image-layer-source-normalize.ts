import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { createOssClientFrom, ossGetBuffer, readOssEnv } from "@/lib/oss-client";

/** Seedream 图层拆分 · 官方输入限制（docs/图片分层.md §5.1） */
export const SEEDREAM_LAYER_MIN_PIXELS = 512 * 512;
export const SEEDREAM_LAYER_MAX_PIXELS = 6000 * 6000;
export const SEEDREAM_LAYER_MIN_ASPECT = 1 / 16;
export const SEEDREAM_LAYER_MAX_ASPECT = 16;
export const SEEDREAM_LAYER_MAX_BYTES = 30 * 1024 * 1024;

function tryParseManagedOssObjectKey(url: string): string | null {
  const cfg = readOssEnv();
  if ("error" in cfg) return null;
  try {
    const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
    if (base && url.startsWith(`${base}/`)) {
      return decodeURIComponent(url.slice(base.length + 1));
    }
    const u = new URL(url);
    if (u.hostname === `${cfg.bucket}.${cfg.region}.aliyuncs.com`) {
      return decodeURIComponent(u.pathname.replace(/^\//, ""));
    }
  } catch {
    return null;
  }
  return null;
}

async function loadImageBuffer(url: string): Promise<Buffer> {
  const trimmed = url.trim();
  const ossKey = tryParseManagedOssObjectKey(trimmed);
  if (ossKey) {
    const cfg = readOssEnv();
    if (!("error" in cfg)) {
      const client = await createOssClientFrom(cfg);
      const buf = await ossGetBuffer(client, { key: ossKey });
      if (buf?.byteLength) return buf;
    }
  }
  const res = await fetch(trimmed, {
    method: "GET",
    signal: AbortSignal.timeout(45_000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`无法读取原图（HTTP ${res.status}），请重新上传后重试`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function resolveSeedreamLayerTargetSize(w: number, h: number): { width: number; height: number } {
  if (w <= 0 || h <= 0) {
    throw new Error("无法读取图片尺寸");
  }
  const aspect = w / h;
  if (aspect < SEEDREAM_LAYER_MIN_ASPECT || aspect > SEEDREAM_LAYER_MAX_ASPECT) {
    throw new Error("图片宽高比超出限制（须在 1:16～16:1 之间），请裁剪后重试");
  }

  let tw = w;
  let th = h;
  let pixels = tw * th;

  if (pixels < SEEDREAM_LAYER_MIN_PIXELS) {
    const scale = Math.sqrt(SEEDREAM_LAYER_MIN_PIXELS / pixels);
    tw = Math.ceil(w * scale);
    th = Math.ceil(h * scale);
    pixels = tw * th;
  }

  if (pixels > SEEDREAM_LAYER_MAX_PIXELS) {
    const scale = Math.sqrt(SEEDREAM_LAYER_MAX_PIXELS / pixels);
    tw = Math.max(1, Math.floor(tw * scale));
    th = Math.max(1, Math.floor(th * scale));
  }

  return { width: tw, height: th };
}

async function encodeSeedreamLayerJpeg(buf: Buffer, width: number, height: number): Promise<Buffer> {
  let quality = 92;
  for (let attempt = 0; attempt < 6; attempt++) {
    const out = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize(width, height, { fit: "fill" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= SEEDREAM_LAYER_MAX_BYTES) return out;
    quality = Math.max(60, quality - 8);
  }
  throw new Error("图片体积超过 30MB，请换用更小尺寸的 PNG/JPEG");
}

/**
 * 图层拆分前统一规范化：解码 → 校正方向 → 尺寸合规 → JPEG 重传 OSS（厂商可拉取直链）。
 */
export async function ensureSeedreamLayerDecomposeImageUrl(opts: {
  userId: string;
  imageUrl: string;
}): Promise<string> {
  const input = await loadImageBuffer(opts.imageUrl);
  if (input.byteLength > SEEDREAM_LAYER_MAX_BYTES) {
    throw new Error("图片过大（最大 30MB）");
  }

  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error("无法解析图片内容，请换用标准 PNG/JPEG 后重试");
  }

  const { width, height } = resolveSeedreamLayerTargetSize(w, h);
  const needsResize = width !== w || height !== h;
  const needsTranscode =
    meta.format !== "jpeg" && meta.format !== "jpg" && meta.format !== "png";

  if (!needsResize && !needsTranscode && input.length <= SEEDREAM_LAYER_MAX_BYTES) {
    const ossKey = tryParseManagedOssObjectKey(opts.imageUrl.trim());
    if (ossKey && /\.(jpe?g|png)$/i.test(ossKey)) {
      return opts.imageUrl.trim();
    }
  }

  const out = await encodeSeedreamLayerJpeg(input, width, height);
  return uploadCanvasUserBuffer({
    userId: opts.userId,
    buf: out,
    contentType: "image/jpeg",
    ext: "jpg",
    preferBucketUrl: true,
  });
}

export function mapSeedreamLayerDecomposeError(
  message: string,
  opts?: { bboxCount?: number; afterEdit?: boolean },
): string {
  const m = message.trim();
  if (/image content could not be processed for layer decomposition/i.test(m)) {
    if (opts?.afterEdit) {
      return "改层已完成，但重拆失败：编辑后的整图无法再次图层拆分。可尝试简化修改描述、减少同时修改的层数，或导出当前结果后重新上传拆分。";
    }
    if (opts?.bboxCount && opts.bboxCount > 0) {
      return "框选拆分失败：模型无法按当前框选区域拆分（可能与区域内容、框太小或重叠有关）。建议先只框一个主体重试，或清除框选改用自动拆分。";
    }
    return "原图无法用于图层拆分。请使用清晰的 PNG/JPEG（边长与总像素在官方限制内，宽高比不超过 16:1），或换一张图后重试。";
  }
  if (/could not be processed/i.test(m) && /image/i.test(m)) {
    return "原图格式或内容不符合图层拆分要求，请换用 PNG/JPEG 并重试。";
  }
  return m;
}
