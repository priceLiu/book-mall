/**
 * 把 KIE 临时 URL 中转到 OSS 的稳定公网 URL（canvas 子域）。
 * 实现方式 mirror book-mall/lib/story/story-oss.ts。
 */
import {
  createOssClientFrom,
  ossUploadBuffer,
  readOssEnv,
  type OssEnvConfig,
} from "@/lib/oss-client";
import {
  buildCanvasOssKey,
  buildQuickReplicaBuiltinOssKey,
  buildStyleLibraryOssKey,
  type CanvasOssKind,
} from "./canvas-constants";
import {
  extractVideoFirstFrameJpeg,
  remuxMp4Faststart,
} from "./video-poster-ffmpeg";

const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB

function virtualHostedPublicUrl(cfg: OssEnvConfig, key: string): string {
  const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  return directBucketPublicUrl(cfg, key);
}

function directBucketPublicUrl(cfg: OssEnvConfig, key: string): string {
  return `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${key}`;
}

function extForUrlPath(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return "";
}

function extForMime(contentType: string): string {
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (base === "image/jpeg" || base === "image/jpg") return "jpg";
  if (base === "image/png") return "png";
  if (base === "image/webp") return "webp";
  if (base === "video/mp4") return "mp4";
  if (base === "audio/mpeg" || base === "audio/mp3") return "mp3";
  if (base === "audio/wav" || base === "audio/x-wav") return "wav";
  return "";
}

async function downloadToBuffer(
  url: string,
  maxBytes: number,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const parsed = new URL(url);
  const r = await fetch(parsed.href, { method: "GET" });
  if (!r.ok) {
    throw new Error(`download failed: HTTP ${r.status}`);
  }
  const contentType = r.headers.get("content-type") ?? "";
  const len = Number(r.headers.get("content-length") ?? "0");
  if (len > 0 && len > maxBytes) {
    throw new Error(`download too large: ${len} > ${maxBytes}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new Error(
      `download too large after fetch: ${buf.byteLength} > ${maxBytes}`,
    );
  }
  const ext = extForMime(contentType) || extForUrlPath(parsed.pathname) || "bin";
  return { buf, contentType, ext };
}

const MULTIPART_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;
const LARGE_UPLOAD_TIMEOUT_MS = 600_000;

/** OSS PUT 可重试的瞬时网络错误（TLS 握手断开 / 连接重置 / 超时等） */
const TRANSIENT_OSS_ERROR =
  /socket disconnected|secure TLS connection|ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up|network|timeout|ConnectionTimeout|RequestTimeout|RequestError/i;

async function uploadBufferToOss(args: {
  cfg: OssEnvConfig;
  key: string;
  buf: Buffer;
  contentType: string;
  /** 百炼等阿里云服务拉取：用 bucket 直链，避免自定义 CDN 域返回异常 */
  preferBucketUrl?: boolean;
}): Promise<string> {
  const useMultipart = args.buf.byteLength >= MULTIPART_UPLOAD_THRESHOLD_BYTES;
  const timeoutMs = useMultipart ? LARGE_UPLOAD_TIMEOUT_MS : 60_000;
  const ct = args.contentType.split(";")[0].trim() || "application/octet-stream";

  // 瞬时网络抖动（如 TLS 握手前 socket 断开）重试；每次重建客户端用全新连接
  const sleeps = [0, 600, 1800];
  let result: { url?: string } | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < sleeps.length; attempt++) {
    if (sleeps[attempt] > 0) {
      await new Promise((r) => setTimeout(r, sleeps[attempt]));
    }
    const client = await createOssClientFrom(args.cfg, { timeoutMs });
    try {
      result = await ossUploadBuffer(client, {
        key: args.key,
        buf: args.buf,
        contentType: ct,
        useMultipart,
        timeoutMs,
      });
      break;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (
        /specified endpoint|must be addressed using the specified endpoint/i.test(raw)
      ) {
        throw new Error(
          `${raw} — 请将 OSS_REGION 改为 OSS 控制台 Bucket 的「访问域名 / 地域」一致。`,
        );
      }
      lastError = e;
      if (attempt < sleeps.length - 1 && TRANSIENT_OSS_ERROR.test(raw)) {
        continue;
      }
      throw e;
    }
  }
  if (!result) {
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? "oss upload failed"));
  }
  const u = typeof result.url === "string" ? result.url.trim() : "";
  if (args.preferBucketUrl) {
    if (/^https:\/\//i.test(u) && u.includes(`${args.cfg.bucket}.`)) {
      return u;
    }
    return directBucketPublicUrl(args.cfg, args.key);
  }
  if (/^https:\/\//i.test(u)) return u;
  return virtualHostedPublicUrl(args.cfg, args.key);
}

export async function persistCanvasKieResultToOss(args: {
  ephemeralUrl: string;
  kind: CanvasOssKind;
  projectId?: string;
  userId?: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const cfg = cfgRaw;

  const maxBytes =
    args.kind === "node-video"
      ? MAX_VIDEO_BYTES
      : args.kind === "node-audio"
        ? MAX_AUDIO_BYTES
        : MAX_IMAGE_BYTES;

  const sleeps = [0, 500, 2000];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < sleeps.length; attempt++) {
    if (sleeps[attempt] > 0) {
      await new Promise((r) => setTimeout(r, sleeps[attempt]));
    }
    try {
      const dl = await downloadToBuffer(args.ephemeralUrl, maxBytes);
      const ext =
        dl.ext ||
        (args.kind === "node-video"
          ? "mp4"
          : args.kind === "node-audio"
            ? "mp3"
            : "png");
      const key = buildCanvasOssKey(args.kind, {
        projectId: args.projectId,
        userId: args.userId,
        ext,
      });
      const defaultCt =
        args.kind === "node-video"
          ? "video/mp4"
          : args.kind === "node-audio"
            ? "audio/mpeg"
            : "image/png";
      // 视频统一做 faststart（moov 移到头部 → 边下边播）；失败/非 mp4 回退原始 buffer。
      const uploadBuf =
        args.kind === "node-video"
          ? ((await remuxMp4Faststart(dl.buf, ext)) ?? dl.buf)
          : dl.buf;
      const ossUrl = await uploadBufferToOss({
        cfg,
        key,
        buf: uploadBuf,
        contentType: dl.contentType || defaultCt,
      });
      return ossUrl;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "persistCanvasKieResultToOss failed"));
}

/** 视频落 OSS 并尝试 ffmpeg 截首帧封面（JPEG → node-image）。 */
export async function persistCanvasVideoResultToOss(args: {
  ephemeralUrl: string;
  projectId?: string;
  userId?: string;
}): Promise<{ videoUrl: string; posterUrl?: string }> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const cfg = cfgRaw;

  const dl = await downloadToBuffer(args.ephemeralUrl, MAX_VIDEO_BYTES);
  const ext = dl.ext || "mp4";
  // faststart：把 moov atom 移到头部，浏览器可边下边播；失败/非 mp4 回退原始 buffer。
  const uploadBuf = (await remuxMp4Faststart(dl.buf, ext)) ?? dl.buf;
  const videoKey = buildCanvasOssKey("node-video", {
    projectId: args.projectId,
    userId: args.userId,
    ext,
  });
  const videoUrl = await uploadBufferToOss({
    cfg,
    key: videoKey,
    buf: uploadBuf,
    contentType: dl.contentType || "video/mp4",
  });

  let posterUrl: string | undefined;
  const frameBuf = await extractVideoFirstFrameJpeg(dl.buf);
  if (frameBuf) {
    try {
      const posterKey = buildCanvasOssKey("node-image", {
        projectId: args.projectId,
        userId: args.userId,
        ext: "jpg",
      });
      posterUrl = await uploadBufferToOss({
        cfg,
        key: posterKey,
        buf: frameBuf,
        contentType: "image/jpeg",
      });
    } catch {
      /* 封面失败不阻断视频 */
    }
  }

  return { videoUrl, posterUrl };
}

/** 直接上传 buffer（TTS 等同步生成）。 */
export async function persistCanvasBufferToOss(args: {
  buf: Buffer;
  contentType: string;
  kind: CanvasOssKind;
  projectId?: string;
  userId?: string;
  ext: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildCanvasOssKey(args.kind, {
    projectId: args.projectId,
    userId: args.userId,
    ext: args.ext,
  });
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: args.contentType,
  });
}

/** 平台风格库预览图（固定 OSS key）。 */
export async function uploadStyleLibraryPreview(args: {
  id: string;
  buf: Buffer;
  contentType: string;
  ext: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildStyleLibraryOssKey(args.id, args.ext);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: args.contentType,
  });
}

/** QuickReplica 内置模板预览图（固定 OSS key）。 */
export async function uploadQuickReplicaBuiltinPreview(args: {
  id: string;
  buf: Buffer;
  contentType: string;
  ext: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildQuickReplicaBuiltinOssKey(args.id, args.ext);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: args.contentType,
  });
}

/** 用户直传：把 buffer 上传到 OSS 并返回公网 URL。 */
export async function uploadCanvasUserBuffer(args: {
  buf: Buffer;
  contentType: string;
  userId: string;
  ext: string;
  preferBucketUrl?: boolean;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildCanvasOssKey("user-upload", {
    userId: args.userId,
    ext: args.ext,
  });
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: args.contentType,
    preferBucketUrl: args.preferBucketUrl,
  });
}
