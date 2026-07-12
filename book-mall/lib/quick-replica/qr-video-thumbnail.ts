import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { extractVideoFirstFrameJpeg } from "@/lib/canvas/video-poster-ffmpeg";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

const MAX_VIDEO_FETCH_BYTES = 200 * 1024 * 1024;

function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.trim());
}

function isImageMediaUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (isVideoMediaUrl(u)) return false;
  return /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(u) || u.startsWith("data:image/");
}

async function fetchVideoBuffer(url: string): Promise<Buffer | null> {
  const trimmed = url.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  try {
    const res = await fetch(trimmed, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength <= 0 || buf.byteLength > MAX_VIDEO_FETCH_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

/** 从成片视频截取首帧并上传到 OSS，返回封面图 URL。 */
export async function extractAndUploadQrVideoPoster(args: {
  userId: string;
  videoUrl: string;
}): Promise<string | null> {
  const buf = await fetchVideoBuffer(args.videoUrl);
  if (!buf) return null;
  const jpeg = await extractVideoFirstFrameJpeg(buf);
  if (!jpeg) return null;
  try {
    return await uploadCanvasUserBuffer({
      userId: args.userId,
      buf: jpeg,
      contentType: "image/jpeg",
      ext: "jpg",
      preferBucketUrl: true,
    });
  } catch {
    return null;
  }
}

/** 不拉取视频、不跑 ffmpeg：仅从 draft 解析静态封面候选。 */
export function pickQrStaticThumbnailCandidate(args: {
  mediaType: "image" | "video" | "audio";
  outputUrl: string;
  draft: QrWorkspaceDraft;
}): string | null {
  if (args.mediaType === "image") {
    const url = args.outputUrl.trim();
    return url || null;
  }
  if (args.mediaType === "audio") {
    const url = args.draft.targetImageUrl?.trim();
    return url || null;
  }
  const sceneRef = args.draft.sceneImageUrls.map((u) => u.trim()).find(isImageMediaUrl);
  if (sceneRef) return sceneRef;
  const target = args.draft.targetImageUrl?.trim();
  if (target && isImageMediaUrl(target)) return target;
  return null;
}

/**
 * 生成任务保存为「我的作品」时的列表封面：
 * - 图片输出 → 成片 URL
 * - 视频输出 → 引用图 / 目标图（若为图片）→ ffmpeg 首帧封面 → 成片 URL（兜底）
 */
export async function resolveQrGenerateThumbnailUrl(args: {
  userId: string;
  mediaType: "image" | "video" | "audio";
  outputUrl: string;
  draft: QrWorkspaceDraft;
}): Promise<string> {
  const staticCandidate = pickQrStaticThumbnailCandidate({
    mediaType: args.mediaType,
    outputUrl: args.outputUrl,
    draft: args.draft,
  });
  if (staticCandidate) return staticCandidate;

  if (args.mediaType !== "video") {
    return args.outputUrl.trim();
  }

  const poster = await extractAndUploadQrVideoPoster({
    userId: args.userId,
    videoUrl: args.outputUrl,
  });
  if (poster) return poster;

  return args.outputUrl.trim();
}
