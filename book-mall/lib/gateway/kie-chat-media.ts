/**
 * KIE Gemini chat 多模态预处理：
 * - 统一 media 结构为 `image_url`（含原 video_url）
 * - HTTPS 参考图改为 data URL，避免 KIE 境外节点拉取国内 OSS 失败
 *   （常见错误：`Failed to get the file information`；OSS 还可能带 force-download）
 */
import sharp from "sharp";

import { createOssClientFrom, ossGetBuffer, readOssEnv } from "@/lib/oss-client";
import type {
  CanvasChatContentPart,
  CanvasChatMessage,
} from "@/lib/canvas/providers/types";

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
/** 内联上限（压缩后）；过大时仍走 URL，避免撑爆请求体 */
const MAX_INLINE_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_EDGE = 2048;

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

function isLikelyVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|mkv)(\?|#|$)/i.test(url);
}

/** KIE 统一媒体结构：video_url → image_url */
export function unifyKieChatMediaParts(
  parts: CanvasChatContentPart[],
): CanvasChatContentPart[] {
  return parts.map((p) => {
    if (p.type === "video_url") {
      return { type: "image_url", image_url: { url: p.video_url.url } };
    }
    return p;
  });
}

async function downloadMediaBuffer(url: string): Promise<{
  buf: Buffer;
  contentType: string;
}> {
  const ossKey = tryParseManagedOssObjectKey(url);
  if (ossKey) {
    const cfg = readOssEnv();
    if (!("error" in cfg)) {
      const client = await createOssClientFrom(cfg);
      const buf = await ossGetBuffer(client, { key: ossKey });
      if (buf?.byteLength) {
        if (buf.byteLength > MAX_DOWNLOAD_BYTES) {
          throw new Error(`参考图过大（>${MAX_DOWNLOAD_BYTES}）`);
        }
        const ext = ossKey.split(".").pop()?.toLowerCase() ?? "";
        const contentType =
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "webp"
              ? "image/webp"
              : ext === "gif"
                ? "image/gif"
                : "image/png";
        return { buf, contentType };
      }
    }
  }

  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(45_000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`参考图下载失败 HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`参考图过大（>${MAX_DOWNLOAD_BYTES}）`);
  }
  const contentType = res.headers.get("content-type") ?? "image/png";
  return { buf, contentType };
}

async function bufferToInlineDataUrl(
  buf: Buffer,
  contentType: string,
): Promise<string | null> {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (ct.startsWith("video/")) return null;

  let out = buf;
  let outCt = ct.startsWith("image/") ? ct : "image/png";

  if (buf.byteLength > 1.5 * 1024 * 1024 || !ct.startsWith("image/")) {
    try {
      out = await sharp(buf, { failOn: "none" })
        .rotate()
        .resize({
          width: MAX_INLINE_EDGE,
          height: MAX_INLINE_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      outCt = "image/jpeg";
    } catch {
      /* keep original */
    }
  }

  if (out.byteLength > MAX_INLINE_BYTES) return null;
  return `data:${outCt};base64,${out.toString("base64")}`;
}

async function ensureKieChatMediaUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("data:")) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  if (isLikelyVideoUrl(trimmed)) return trimmed;

  try {
    const { buf, contentType } = await downloadMediaBuffer(trimmed);
    if (contentType.toLowerCase().startsWith("video/")) return trimmed;
    const dataUrl = await bufferToInlineDataUrl(buf, contentType);
    return dataUrl ?? trimmed;
  } catch {
    return trimmed;
  }
}

export async function prepareKieChatMessages(
  messages: CanvasChatMessage[],
): Promise<CanvasChatMessage[]> {
  const out: CanvasChatMessage[] = [];
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      out.push(msg);
      continue;
    }
    const unified = unifyKieChatMediaParts(msg.content);
    const parts: CanvasChatContentPart[] = [];
    for (const part of unified) {
      if (part.type === "image_url") {
        const url = await ensureKieChatMediaUrl(part.image_url.url);
        parts.push({ type: "image_url", image_url: { url } });
      } else {
        parts.push(part);
      }
    }
    out.push({ role: msg.role, content: parts });
  }
  return out;
}
