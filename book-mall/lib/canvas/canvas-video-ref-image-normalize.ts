import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

/** KIE Kling 等图生视频 · 参考图最短边下限（厂商 422 校验） */
export const KIE_VIDEO_REF_MIN_EDGE_PX = 300;

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`无法下载参考图：HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("参考图文件过大");
  }
  return buf;
}

async function ensureMinEdgeBuffer(
  buf: Buffer,
  minEdge: number,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const meta = await sharp(buf, { failOn: "none" }).rotate().metadata();
  let w = meta.width ?? 0;
  let h = meta.height ?? 0;
  if (w < 1 || h < 1) {
    throw new Error("无法解析参考图尺寸");
  }

  const shortest = Math.min(w, h);
  if (shortest >= minEdge) {
    const fmt = meta.format === "png" ? "png" : "jpeg";
    if (fmt === "png" && meta.hasAlpha) {
      const out = await sharp(buf, { failOn: "none" })
        .rotate()
        .png({ compressionLevel: 9 })
        .toBuffer();
      return { buf: out, contentType: "image/png", ext: "png" };
    }
    const out = await sharp(buf, { failOn: "none" })
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return { buf: out, contentType: "image/jpeg", ext: "jpg" };
  }

  const scale = minEdge / shortest;
  let nw = Math.round(w * scale);
  let nh = Math.round(h * scale);
  if (Math.min(nw, nh) < minEdge) {
    if (nw <= nh) nw = minEdge;
    else nh = minEdge;
  }

  const out = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize(nw, nh, { fit: "fill" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return { buf: out, contentType: "image/jpeg", ext: "jpg" };
}

/** 过小的 HTTPS 参考图放大后重传 OSS，满足 KIE 最短边 ≥ 300px */
export async function ensureKieVideoRefImageUrl(args: {
  userId: string;
  url: string;
  minEdge?: number;
}): Promise<string> {
  const url = args.url.trim();
  if (!url || !/^https?:\/\//.test(url)) return url;
  if (url.startsWith("asset://")) return url;

  const minEdge = args.minEdge ?? KIE_VIDEO_REF_MIN_EDGE_PX;
  const source = await fetchImageBuffer(url);
  const meta = await sharp(source, { failOn: "none" }).metadata();
  const shortest = Math.min(meta.width ?? 0, meta.height ?? 0);
  if (shortest >= minEdge) return url;

  const normalized = await ensureMinEdgeBuffer(source, minEdge);
  return uploadCanvasUserBuffer({
    userId: args.userId,
    buf: normalized.buf,
    contentType: normalized.contentType,
    ext: normalized.ext,
    preferBucketUrl: true,
  });
}

export async function normalizeKieVideoRefImageUrls(args: {
  userId: string;
  mainFrameImageUrl?: string;
  referenceImageUrls?: string[];
  lastFrameImageUrl?: string;
}): Promise<{
  mainFrameImageUrl: string;
  referenceImageUrls: string[];
  lastFrameImageUrl: string;
}> {
  const main = args.mainFrameImageUrl?.trim() ?? "";
  const refs = (args.referenceImageUrls ?? []).map((u) => u.trim()).filter(Boolean);
  const last = args.lastFrameImageUrl?.trim() ?? "";

  const cache = new Map<string, string>();
  const normOne = async (u: string): Promise<string> => {
    if (!u) return u;
    const hit = cache.get(u);
    if (hit) return hit;
    const next = await ensureKieVideoRefImageUrl({ userId: args.userId, url: u });
    cache.set(u, next);
    return next;
  };

  const [mainOut, ...refsOut] = await Promise.all([
    main ? normOne(main) : Promise.resolve(""),
    ...refs.map((u) => normOne(u)),
  ]);
  const lastOut = last ? await normOne(last) : "";

  return {
    mainFrameImageUrl: mainOut,
    referenceImageUrls: refsOut,
    lastFrameImageUrl: lastOut,
  };
}
