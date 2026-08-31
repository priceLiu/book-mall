import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { isLikelyVideoUrl } from "@/lib/canvas/media-url-kind";
import { ffprobeDurationSec } from "@/lib/media/render-ffmpeg";
import { readOssEnv } from "@/lib/oss-client";
import {
  FILM_PULL_MAX_VIDEO_BYTES,
  FILM_PULL_SEGMENT_ENABLED,
  FILM_PULL_V1_MAX_SEC,
} from "@/lib/ecom/ecom-film-pull-types";
import type { FilmPullMediaReference } from "@/lib/ecom/ecom-film-pull-types";

export { FILM_PULL_V1_MAX_SEC, FILM_PULL_SEGMENT_ENABLED };

const MAX_URL_LEN = 8192;

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

export function newFilmPullMediaId(): string {
  return createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 16);
}

async function probeVideoDurationSec(buf: Buffer): Promise<number | undefined> {
  const dir = await mkdtemp(join(tmpdir(), "film-pull-probe-"));
  const path = join(dir, "probe.mp4");
  try {
    await writeFile(path, buf);
    const sec = await ffprobeDurationSec(path);
    return Number.isFinite(sec) && sec > 0 ? sec : undefined;
  } catch {
    return undefined;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function assertFilmPullDurationAllowed(durationSec: number | undefined): void {
  if (!Number.isFinite(durationSec) || !durationSec || durationSec <= 0) return;
  if (durationSec > FILM_PULL_V1_MAX_SEC && !FILM_PULL_SEGMENT_ENABLED) {
    throw new Error(
      `当前版本支持 ${FILM_PULL_V1_MAX_SEC}s 以内视频；您的素材约 ${Math.ceil(durationSec)}s。长片分段功能即将开放。`,
    );
  }
}

export async function resolveFilmPullUpload(opts: {
  userId: string;
  buf: Buffer;
  contentType: string;
  fileName?: string;
}): Promise<{ ossUrl: string; durationSec?: number }> {
  if (opts.buf.byteLength > FILM_PULL_MAX_VIDEO_BYTES) {
    throw new Error("视频文件过大");
  }
  const ct = opts.contentType.toLowerCase();
  if (!ct.includes("video") && !opts.fileName?.match(/\.(mp4|webm|mov)$/i)) {
    throw new Error("专业拉片仅支持视频素材");
  }
  const durationSec = await probeVideoDurationSec(opts.buf);
  assertFilmPullDurationAllowed(durationSec);
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    buf: opts.buf,
    ext: "mp4",
    contentType: opts.contentType || "video/mp4",
  });
  return { ossUrl, durationSec };
}

export async function resolveFilmPullFromUrl(opts: {
  userId: string;
  url: string;
}): Promise<{ ossUrl: string; sourceUrl: string; durationSec?: number }> {
  const publicUrl = takePublicHttpsUrl(opts.url);
  if (!publicUrl) throw new Error("请提供有效的 HTTPS 视频链接");
  if (!isLikelyVideoUrl(publicUrl)) throw new Error("链接须指向视频文件");

  const head = await fetch(publicUrl, { method: "HEAD" });
  const len = Number(head.headers.get("content-length") ?? "0");
  if (len > FILM_PULL_MAX_VIDEO_BYTES) throw new Error("远程视频过大");

  const res = await fetch(publicUrl);
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > FILM_PULL_MAX_VIDEO_BYTES) throw new Error("远程视频过大");

  const durationSec = await probeVideoDurationSec(buf);
  assertFilmPullDurationAllowed(durationSec);

  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    buf,
    ext: "mp4",
    contentType: res.headers.get("content-type") || "video/mp4",
  });
  return { ossUrl, sourceUrl: publicUrl, durationSec };
}

export async function resolveFilmPullCharacterUpload(opts: {
  userId: string;
  buf: Buffer;
  contentType: string;
}): Promise<string> {
  const ct = opts.contentType.toLowerCase();
  if (!ct.includes("image")) throw new Error("角色参考须为图片");
  if (opts.buf.byteLength > 30 * 1024 * 1024) throw new Error("图片过大");
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  return uploadCanvasUserBuffer({
    userId: opts.userId,
    buf: opts.buf,
    ext,
    contentType: opts.contentType,
  });
}

export function isManagedPublicOssUrl(url: string): boolean {
  const cfg = readOssEnv();
  if ("error" in cfg) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
    if (base && url.startsWith(`${base}/`)) return true;
    return u.hostname.includes("aliyuncs.com");
  } catch {
    return false;
  }
}

export type { FilmPullMediaReference };
