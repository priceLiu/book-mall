/**
 * 万相 3.0 reference_image / first_frame · 厂商可读 JPEG（去透明通道、240～8000px、≤20MB）
 * @see https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference
 */
import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import type { DashscopeWan30MediaItem } from "@/lib/canvas/dashscope-sbv1-t2v";
import { isLikelyReferenceImageUrl, isLikelyVideoUrl } from "@/lib/canvas/media-url-kind";
import { createOssClientFrom, ossGetBuffer, readOssEnv } from "@/lib/oss-client";

export const WAN30_REF_IMAGE_MIN_SIDE = 240;
export const WAN30_REF_IMAGE_MAX_SIDE = 8000;
export const WAN30_REF_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

function tryParseManagedOssObjectKey(url: string): string | null {
  const cfg = readOssEnv();
  if ("error" in cfg) return null;
  try {
    const u = new URL(url);
    const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
    if (base && url.startsWith(`${base}/`)) {
      return decodeURIComponent(url.slice(base.length + 1));
    }
    if (u.hostname === `${cfg.bucket}.${cfg.region}.aliyuncs.com`) {
      return decodeURIComponent(u.pathname.replace(/^\//, ""));
    }
  } catch {
    return null;
  }
  return null;
}

function assertProbablyImageBytes(buf: Buffer, contentType: string | null): void {
  if (buf.length < 12) {
    throw new Error("参考图文件为空或过短，请确认上游图片节点已生成完成");
  }
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/json")) {
    throw new Error(
      "参考图 URL 返回了网页/JSON 而非图片，请确认上游图片已上传 OSS 后再试",
    );
  }
  const head = buf.subarray(0, 12);
  const isJpeg = head[0] === 0xff && head[1] === 0xd8;
  const isPng =
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47;
  const isWebp =
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    buf.subarray(8, 12).toString("ascii") === "WEBP";
  const isBmp = head[0] === 0x42 && head[1] === 0x4d;
  if (!isJpeg && !isPng && !isWebp && !isBmp && !ct.startsWith("image/")) {
    throw new Error(
      "参考图不是有效的 JPEG/PNG/WEBP/BMP，请检查上游连线是否为图片节点成片",
    );
  }
}

function rethrowWan30SharpError(imageUrl: string, err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (/unsupported image format|Input buffer/i.test(msg)) {
    const hint = imageUrl.includes("/node-image/")
      ? "node-image"
      : imageUrl.slice(0, 80);
    throw new Error(
      `参考图无法解析（${hint}）：文件可能损坏、仍为临时链接，或上游尚未生成完成。请等待上游图片节点出图后再试。`,
    );
  }
  throw err instanceof Error ? err : new Error(msg);
}

async function loadReferenceImageBuffer(
  imageUrl: string,
): Promise<{ buf: Buffer; contentType: string | null }> {
  const url = imageUrl.trim();
  const ossKey = tryParseManagedOssObjectKey(url);
  if (ossKey) {
    const cfg = readOssEnv();
    if (!("error" in cfg)) {
      const client = await createOssClientFrom(cfg);
      const buf = await ossGetBuffer(client, { key: ossKey });
      if (buf?.byteLength) {
        assertProbablyImageBytes(buf, null);
        return { buf, contentType: null };
      }
    }
  }

  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new Error(`下载参考图失败 HTTP ${res.status}，请确认上游图片可公网访问`);
  }
  const contentType = res.headers.get("content-type");
  const buf = Buffer.from(await res.arrayBuffer());
  assertProbablyImageBytes(buf, contentType);
  return { buf, contentType };
}

export function resolveWan30ReferenceImageDimensions(
  w: number,
  h: number,
): { width: number; height: number } {
  let targetW = w;
  let targetH = h;
  if (Math.min(w, h) < WAN30_REF_IMAGE_MIN_SIDE) {
    const scale = WAN30_REF_IMAGE_MIN_SIDE / Math.min(w, h);
    targetW = Math.ceil(w * scale);
    targetH = Math.ceil(h * scale);
  }
  const maxDim = Math.max(targetW, targetH);
  if (maxDim > WAN30_REF_IMAGE_MAX_SIDE) {
    const shrink = WAN30_REF_IMAGE_MAX_SIDE / maxDim;
    targetW = Math.max(WAN30_REF_IMAGE_MIN_SIDE, Math.floor(targetW * shrink));
    targetH = Math.max(WAN30_REF_IMAGE_MIN_SIDE, Math.floor(targetH * shrink));
  }
  return { width: targetW, height: targetH };
}

async function encodeWan30Jpeg(buf: Buffer, w: number, h: number): Promise<Buffer> {
  let quality = 90;
  for (let attempt = 0; attempt < 6; attempt++) {
    const out = await sharp(buf, { failOn: "none" })
      .rotate()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(w, h, { fit: "fill" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= WAN30_REF_IMAGE_MAX_BYTES) return out;
    quality = Math.max(55, quality - 10);
  }
  throw new Error("参考图体积超过 20MB，请换用更小尺寸的参考图");
}

/**
 * 将参考图规范为万相 3.0 可读的 JPEG（避免透明 PNG / 非常规 WebP / 非图片 buffer 触发 500）。
 * 始终重编码并上传 OSS，保证 DashScope 拉取到的字节与 MIME 一致。
 */
export async function ensureWan30ReferenceImageUrl(opts: {
  userId: string;
  imageUrl: string;
}): Promise<{ url: string; normalized: boolean }> {
  const imageUrl = opts.imageUrl.trim();
  if (!imageUrl || !isLikelyReferenceImageUrl(imageUrl)) {
    throw new Error("参考图 URL 无效（不能为视频或 3D 资源）");
  }
  if (isLikelyVideoUrl(imageUrl)) {
    throw new Error("参考图 URL 不能为视频链接，请连接上游视频节点的 mp4 成片");
  }

  try {
    const { buf } = await loadReferenceImageBuffer(imageUrl);
    const meta = await sharp(buf, { failOn: "none" }).rotate().metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h) {
      throw new Error("无法读取参考图尺寸，请换用上游图片节点的 OSS 成片");
    }

    const { width, height } = resolveWan30ReferenceImageDimensions(w, h);
    const out = await encodeWan30Jpeg(buf, width, height);
    const url = await uploadCanvasUserBuffer({
      userId: opts.userId,
      ext: "jpg",
      buf: out,
      contentType: "image/jpeg",
    });
    return { url, normalized: url !== imageUrl };
  } catch (err) {
    rethrowWan30SharpError(imageUrl, err);
  }
}

export async function ensureWan30ReferenceImageUrls(opts: {
  userId: string;
  urls: readonly string[];
}): Promise<string[]> {
  const out: string[] = [];
  for (const raw of opts.urls) {
    const url = raw.trim();
    if (!url || !isLikelyReferenceImageUrl(url)) continue;
    const row = await ensureWan30ReferenceImageUrl({
      userId: opts.userId,
      imageUrl: url,
    });
    out.push(row.url);
  }
  return out;
}

const WAN30_IMAGE_MEDIA_TYPES = new Set([
  "first_frame",
  "last_frame",
  "reference_image",
]);

/** 提交 DashScope 前规范化 media 内全部图像槽（首帧 / 尾帧 / reference_image）。 */
export async function normalizeWan30MediaImageUrls(opts: {
  userId: string;
  media: readonly DashscopeWan30MediaItem[];
}): Promise<DashscopeWan30MediaItem[]> {
  const out: DashscopeWan30MediaItem[] = [];
  for (const item of opts.media) {
    if (!WAN30_IMAGE_MEDIA_TYPES.has(item.type)) {
      out.push(item);
      continue;
    }
    const row = await ensureWan30ReferenceImageUrl({
      userId: opts.userId,
      imageUrl: item.url,
    });
    out.push({ ...item, url: row.url });
  }
  return out;
}
