import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

/** 百炼 aitryon-parsing：400 < 最短边，最长边 < 7000 */
const PARSING_MIN_EDGE = 401;
const PARSING_HARD_MAX = 7000;
const PARSING_SAFE_MAX = 3200;
const PARSING_MIN_BYTES = 5 * 1024;
const PARSING_MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`无法下载图片：HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error("图片文件过大");
  return buf;
}

function parsingDimensionsOk(w: number, h: number): boolean {
  const maxEdge = Math.max(w, h);
  const minEdge = Math.min(w, h);
  return maxEdge > 0 && maxEdge < PARSING_HARD_MAX && minEdge > 400;
}

async function ensureMinParsingEdge(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  let w = meta.width ?? 0;
  let h = meta.height ?? 0;
  if (w < 1 || h < 1) throw new Error("无法解析图片尺寸");

  const minEdge = Math.min(w, h);
  if (minEdge > 400) return buf;

  const scale = PARSING_MIN_EDGE / minEdge;
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  if (Math.max(nw, nh) < PARSING_HARD_MAX) {
    return sharp(buf).resize(nw, nh).jpeg({ quality: 88 }).toBuffer();
  }

  const padW = Math.max(w, PARSING_MIN_EDGE);
  const padH = Math.max(h, PARSING_MIN_EDGE);
  const left = Math.floor((padW - w) / 2);
  const right = padW - w - left;
  const top = Math.floor((padH - h) / 2);
  const bottom = padH - h - top;
  return sharp(buf)
    .extend({
      left,
      right,
      top,
      bottom,
      background: { r: 245, g: 245, b: 245 },
    })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function normalizeImageBufferForParsing(source: Buffer): Promise<Buffer> {
  let quality = 88;
  let buf = await sharp(source, { failOn: "none" })
    .rotate()
    .resize(PARSING_SAFE_MAX, PARSING_SAFE_MAX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality })
    .toBuffer();

  buf = await ensureMinParsingEdge(buf);

  for (let attempt = 0; attempt < 6; attempt++) {
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 1 || h < 1) throw new Error("无法解析图片尺寸");

    const maxEdge = Math.max(w, h);
    const minEdge = Math.min(w, h);
    const dimsOk = parsingDimensionsOk(w, h);
    const sizeOk =
      buf.byteLength >= PARSING_MIN_BYTES && buf.byteLength <= PARSING_MAX_BYTES;

    if (dimsOk && sizeOk) return buf;

    if (minEdge <= 400) {
      buf = await ensureMinParsingEdge(buf);
      continue;
    }

    if (maxEdge >= PARSING_HARD_MAX) {
      buf = await sharp(buf)
        .resize(PARSING_HARD_MAX - 1, PARSING_HARD_MAX - 1, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality })
        .toBuffer();
      buf = await ensureMinParsingEdge(buf);
      continue;
    }

    if (buf.byteLength > PARSING_MAX_BYTES) {
      quality = Math.max(55, quality - 12);
      buf = await sharp(buf).jpeg({ quality }).toBuffer();
      continue;
    }

    if (buf.byteLength < PARSING_MIN_BYTES) {
      quality = Math.min(95, quality + 8);
      buf = await sharp(buf).jpeg({ quality, mozjpeg: true }).toBuffer();
      continue;
    }

    break;
  }

  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!parsingDimensionsOk(w, h)) {
    throw new Error(
      `图片尺寸不符合分割要求（${w}×${h}px；最短边须大于 400、最长边须小于 7000），请换一张更清晰的参考图`,
    );
  }
  if (buf.byteLength > PARSING_MAX_BYTES) {
    throw new Error("图片归一化后仍超过 5MB，请换一张较小的参考图");
  }
  return buf;
}

/** 归一化后上传 OSS，供 aitryon-parsing-v1 使用 */
export async function ensureVtonParsingImageUrl(
  userId: string,
  sourceUrl: string,
): Promise<string> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error("缺少图片地址");

  const sourceBuf = await fetchImageBuffer(trimmed);
  const meta = await sharp(sourceBuf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const withinSide = parsingDimensionsOk(w, h);
  const withinBytes =
    sourceBuf.byteLength >= PARSING_MIN_BYTES && sourceBuf.byteLength <= PARSING_MAX_BYTES;

  if (withinSide && withinBytes) return trimmed;

  const normalized = await normalizeImageBufferForParsing(sourceBuf);
  return uploadCanvasUserBuffer({
    userId,
    buf: normalized,
    contentType: "image/jpeg",
    ext: "jpg",
    preferBucketUrl: true,
  });
}
