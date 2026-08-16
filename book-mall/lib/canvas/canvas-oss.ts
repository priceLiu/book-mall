/**
 * 把 KIE 临时 URL 中转到 OSS 的稳定公网 URL（canvas 子域）。
 * 实现方式 mirror book-mall/lib/story/story-oss.ts。
 */
import {
  createOssClientFrom,
  ossHeadObject,
  ossUploadBuffer,
  readOssEnv,
  type OssEnvConfig,
} from "@/lib/oss-client";
import {
  buildCanvasOssKey,
  buildQuickReplicaBuiltinOssKey,
  buildQuickReplicaBuiltinSplatOssKey,
  buildMinimaxVoicePreviewOssKey,
  buildStyleLibraryOssKey,
  buildEcomModelLibraryOssKey,
  buildEcomTemplateGalleryOssKey,
  buildEcomTemplateGallerySlotOssKey,
  buildEcomTemplateGalleryThumbOssKey,
  type EcomTemplateGalleryUploadSlot,
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
/** multipart 失败后改用单次 put 的上限（过大 put 易超时） */
const PUT_FALLBACK_MAX_BYTES = 20 * 1024 * 1024;
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
  const preferMultipart = args.buf.byteLength >= MULTIPART_UPLOAD_THRESHOLD_BYTES;
  const timeoutMs = preferMultipart ? LARGE_UPLOAD_TIMEOUT_MS : 60_000;
  const ct = args.contentType.split(";")[0].trim() || "application/octet-stream";

  // 瞬时网络抖动重试；multipart 用 parallel=1 降低并发 TLS 断连；末次可改 put。
  const sleeps = [0, 600, 1800, 4000];
  let result: { url?: string } | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < sleeps.length; attempt++) {
    if (sleeps[attempt] > 0) {
      await new Promise((r) => setTimeout(r, sleeps[attempt]));
    }
    const useMultipart =
      preferMultipart &&
      !(
        attempt === sleeps.length - 1 &&
        args.buf.byteLength <= PUT_FALLBACK_MAX_BYTES
      );
    const client = await createOssClientFrom(args.cfg, {
      timeoutMs: useMultipart ? timeoutMs : Math.max(timeoutMs, 120_000),
    });
    try {
      result = await ossUploadBuffer(client, {
        key: args.key,
        buf: args.buf,
        contentType: ct,
        useMultipart,
        timeoutMs: useMultipart ? timeoutMs : Math.max(timeoutMs, 120_000),
        multipartParallel: 1,
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
      if (
        attempt < sleeps.length - 1 &&
        preferMultipart &&
        args.buf.byteLength <= PUT_FALLBACK_MAX_BYTES
      ) {
        // multipart 非瞬时错误时仍允许末次 put 兜底
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

/** 电商工具箱 · 平台模特库（固定 OSS key）。 */
export async function uploadEcomModelLibraryPreview(args: {
  id: string;
  buf: Buffer;
  contentType: string;
  ext: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildEcomModelLibraryOssKey(args.id, args.ext);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: args.contentType,
  });
}

function isOssNotFoundError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /NoSuchKey|404|not exist|Not Found/i.test(msg);
}

/** 检查 OSS 对象是否已存在（用于导入同名跳过）。 */
/** head 探测与 PUT 一样会遇到 TLS 握手重置；不重试会把整条导入打成 500 */
const OSS_HEAD_RETRY_SLEEPS = [0, 500, 1500, 3500];

export async function ossObjectExists(key: string): Promise<boolean> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < OSS_HEAD_RETRY_SLEEPS.length; attempt++) {
    if (OSS_HEAD_RETRY_SLEEPS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, OSS_HEAD_RETRY_SLEEPS[attempt]));
    }
    try {
      const client = await createOssClientFrom(cfgRaw);
      await ossHeadObject(client, key);
      return true;
    } catch (e) {
      if (isOssNotFoundError(e)) return false;
      lastError = e;
      const raw = e instanceof Error ? e.message : String(e);
      if (!TRANSIENT_OSS_ERROR.test(raw)) throw e;
    }
  }
  throw lastError;
}

/** 由 OSS key 推导公网 URL（catalog 跳过上传时补 URL）。 */
export function ossPublicUrlForKeyFromEnv(key: string): string {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  return `https://${cfgRaw.bucket}.${cfgRaw.region}.aliyuncs.com/${key}`;
}

/** 电商工具箱 · 模板区案例图（固定 OSS key）。 */
export async function uploadEcomTemplateGalleryPreview(args: {
  category: string;
  id: string;
  buf: Buffer;
  contentType: string;
  ext: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildEcomTemplateGalleryOssKey(args.category, args.id, args.ext);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: args.contentType,
  });
}

/** 电商工具箱 · 模板区预生成缩略图（{id}-thumb.webp）。 */
export async function uploadEcomTemplateGalleryThumb(args: {
  category: string;
  id: string;
  buf: Buffer;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildEcomTemplateGalleryThumbOssKey(args.category, args.id);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: "image/webp",
  });
}

export type EcomTemplateGallerySlotUploadResult = {
  url: string;
  thumbUrl?: string;
  coverUrl?: string;
};

/** 管理后台 · 按槽位上传（cover / main / ref 与 preview 分离） */
export async function uploadEcomTemplateGallerySlot(args: {
  category: string;
  id: string;
  slot: EcomTemplateGalleryUploadSlot;
  buf: Buffer;
  contentType: string;
  ext: string;
  refKey?: string;
  /** preview / main 图片：顺带生成 thumb；preview / main 且尚无 cover 时写入 cover 槽 */
  autoCover?: boolean;
}): Promise<EcomTemplateGallerySlotUploadResult> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildEcomTemplateGallerySlotOssKey(
    args.category,
    args.id,
    args.slot,
    args.ext,
    args.refKey,
  );
  const url = await uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: args.contentType,
  });

  const isImage = args.contentType.startsWith("image/");
  let thumbUrl: string | undefined;
  let coverUrl: string | undefined;

  if (
    isImage &&
    (args.slot === "preview" || args.slot === "main")
  ) {
    const { buildEcomGalleryThumbWebp } = await import("@/lib/ecom/ecom-gallery-thumb");
    const thumbBuf = await buildEcomGalleryThumbWebp(args.buf);
    thumbUrl = await uploadEcomTemplateGalleryThumb({
      category: args.category,
      id: args.id,
      buf: thumbBuf,
    });
  }

  if (isImage && args.autoCover && args.slot !== "cover" && args.slot !== "ref") {
    const coverKey = buildEcomTemplateGallerySlotOssKey(
      args.category,
      args.id,
      "cover",
      args.ext,
    );
    coverUrl = await uploadBufferToOss({
      cfg: cfgRaw,
      key: coverKey,
      buf: args.buf,
      contentType: args.contentType,
    });
  }

  return { url, thumbUrl, coverUrl };
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

/** QuickReplica 内置场景 splat（100k / full_res 等，固定 OSS key）。 */
export async function uploadQuickReplicaBuiltinSplat(args: {
  templateId: string;
  tier: string;
  buf: Buffer;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildQuickReplicaBuiltinSplatOssKey(args.templateId, args.tier);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: "application/octet-stream",
  });
}

/** MiniMax 音色试听 MP3（固定 OSS key） */
export async function uploadMinimaxVoicePreview(args: {
  voiceId: string;
  buf: Buffer;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key = buildMinimaxVoicePreviewOssKey(args.voiceId);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: "audio/mpeg",
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
