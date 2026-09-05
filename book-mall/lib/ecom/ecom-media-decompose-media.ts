import { createHash } from "node:crypto";

import { assertCanvasUserUploadOssUrl } from "@/lib/canvas/canvas-user-oss-read";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { isLikelyVideoUrl } from "@/lib/canvas/media-url-kind";
import { readOssEnv } from "@/lib/oss-client";
import type { MediaDecomposeKind } from "@/lib/ecom/ecom-media-decompose-types";

const MAX_URL_LEN = 8192;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h.startsWith("127.")) return true;
  if (h === "::1" || h === "[::1]") return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  const m = /^172\.(\d+)\./.exec(h);
  if (m) {
    const second = Number.parseInt(m[1]!, 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (h.startsWith("169.254.")) return true;
  return false;
}

export function takePublicHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > MAX_URL_LEN) return null;
  if (!/^https:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (isPrivateOrLocalHost(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function isManagedPublicOssUrl(url: string): boolean {
  const cfg = readOssEnv();
  if ("error" in cfg) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
    if (base && url.startsWith(`${base}/`)) return true;
    return u.hostname === `${cfg.bucket}.${cfg.region}.aliyuncs.com`;
  } catch {
    return false;
  }
}

function kindFromContentType(contentType: string, url: string): MediaDecomposeKind | null {
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (base.startsWith("video/")) return "video";
  if (base.startsWith("image/")) return "image";
  if (isLikelyVideoUrl(url)) return "video";
  if (/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(url)) return "image";
  return null;
}

function extFromKind(kind: MediaDecomposeKind, contentType: string): string {
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (kind === "video") return base === "video/quicktime" ? "mov" : "mp4";
  if (base === "image/png") return "png";
  if (base === "image/webp") return "webp";
  return "jpg";
}

function kindFromFile(file: { type: string; name: string }): MediaDecomposeKind | null {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  const name = file.name.toLowerCase();
  if (/\.(mp4|mov|webm)(\?|$)/.test(name)) return "video";
  if (/\.(jpe?g|png|webp|gif)(\?|$)/.test(name)) return "image";
  return null;
}

export async function resolveMediaDecomposeUpload(args: {
  userId: string;
  buf: Buffer;
  contentType: string;
  fileName?: string;
}): Promise<{ kind: MediaDecomposeKind; ossUrl: string }> {
  const pseudoFile = {
    type: args.contentType,
    name: args.fileName ?? "",
  };
  const kind = kindFromFile(pseudoFile) ?? kindFromContentType(args.contentType, args.fileName ?? "");
  if (!kind) {
    throw new Error("不支持的文件类型，请上传图片或视频");
  }
  const max = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (args.buf.byteLength > max) {
    throw new Error(kind === "video" ? "视频过大（最大 100MB）" : "图片过大（最大 30MB）");
  }
  const ext = extFromKind(kind, args.contentType || (kind === "video" ? "video/mp4" : "image/jpeg"));
  const ossUrl = await uploadCanvasUserBuffer({
    userId: args.userId,
    buf: args.buf,
    contentType: args.contentType || (kind === "video" ? "video/mp4" : "image/jpeg"),
    ext,
  });
  return { kind, ossUrl };
}

export async function resolveMediaDecomposeFromUrl(args: {
  userId: string;
  url: string;
}): Promise<{ kind: MediaDecomposeKind; ossUrl: string; sourceUrl: string }> {
  const sourceUrl = takePublicHttpsUrl(args.url);
  if (!sourceUrl) {
    throw new Error("URL 须为公网 https 地址，且不能为内网或 localhost");
  }

  if (isManagedPublicOssUrl(sourceUrl)) {
    try {
      assertCanvasUserUploadOssUrl(sourceUrl, args.userId);
    } catch {
      throw new Error("无权使用该 OSS 地址");
    }
    const kind = isLikelyVideoUrl(sourceUrl) ? "video" : "image";
    return { kind, ossUrl: sourceUrl, sourceUrl };
  }

  const head = await fetch(sourceUrl, { method: "HEAD", redirect: "follow" });
  let contentType = head.headers.get("content-type") ?? "";
  let buf: Buffer;

  if (head.ok) {
    const len = Number(head.headers.get("content-length") ?? "0");
    const guessedKind = kindFromContentType(contentType, sourceUrl) ?? (isLikelyVideoUrl(sourceUrl) ? "video" : "image");
    const max = guessedKind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (len > max) {
      throw new Error(guessedKind === "video" ? "远程视频过大（最大 100MB）" : "远程图片过大（最大 30MB）");
    }
  }

  const getRes = await fetch(sourceUrl, { method: "GET", redirect: "follow" });
  if (!getRes.ok) {
    throw new Error(`无法拉取远程资源（HTTP ${getRes.status}）`);
  }
  contentType = getRes.headers.get("content-type") ?? contentType;
  buf = Buffer.from(await getRes.arrayBuffer());

  const kind = kindFromContentType(contentType, sourceUrl);
  if (!kind) {
    throw new Error("无法识别远程资源类型，请提供图片或视频 URL");
  }
  const max = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (buf.byteLength > max) {
    throw new Error(kind === "video" ? "远程视频过大（最大 100MB）" : "远程图片过大（最大 30MB）");
  }

  const ext = extFromKind(kind, contentType);
  const ossUrl = await uploadCanvasUserBuffer({
    userId: args.userId,
    buf,
    contentType: contentType.split(";")[0] || (kind === "video" ? "video/mp4" : "image/jpeg"),
    ext,
  });
  return { kind, ossUrl, sourceUrl };
}

export function newMediaRefId(): string {
  return createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 16);
}

export function inferKindFromOssUrl(ossUrl: string): MediaDecomposeKind {
  return isLikelyVideoUrl(ossUrl) ? "video" : "image";
}
