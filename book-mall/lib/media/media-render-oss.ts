import { createReadStream } from "fs";
import { stat } from "fs/promises";

import {
  createOssClientFrom,
  ossUploadBuffer,
  readOssEnv,
  withOssRetry,
  type OssEnvConfig,
} from "@/lib/oss-client";
import { extractManagedOssObjectKey } from "@/lib/oss-delete-object";

export function buildMediaRenderEphemeralKey(
  userId: string,
  jobId: string,
): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `media-render/ephemeral/${safeUser}/${jobId}.mp4`;
}

export function buildMediaRenderEphemeralPosterKey(
  userId: string,
  jobId: string,
): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `media-render/ephemeral/${safeUser}/${jobId}.poster.jpg`;
}

export function buildMediaRenderPinnedPosterKey(
  userId: string,
  jobId: string,
): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `media-render/pinned/${safeUser}/${jobId}.poster.jpg`;
}

export function buildMediaRenderPinnedKey(
  userId: string,
  jobId: string,
): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `media-render/pinned/${safeUser}/${jobId}.mp4`;
}

function publicUrlForKey(cfg: OssEnvConfig, key: string, preferBucket?: boolean): string {
  if (!preferBucket) {
    const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
    if (base) return `${base}/${key}`;
  }
  return `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${key}`;
}

const MEDIA_RENDER_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const MEDIA_RENDER_MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;
const MEDIA_RENDER_MULTIPART_PART_SIZE = 5 * 1024 * 1024;

type OssMultipartPathClient = {
  multipartUpload: (
    name: string,
    file: string | ReturnType<typeof createReadStream>,
    options?: {
      parallel?: number;
      partSize?: number;
      timeout?: number;
      mime?: string;
      progress?: (ratio: number) => void;
      headers?: Record<string, string>;
    },
  ) => Promise<{ url?: string }>;
};

async function uploadBufferToOss(args: {
  cfg: OssEnvConfig;
  key: string;
  buf: Buffer;
  contentType: string;
  preferBucketUrl?: boolean;
}): Promise<string> {
  const client = await createOssClientFrom(args.cfg, {
    timeoutMs: MEDIA_RENDER_UPLOAD_TIMEOUT_MS,
  });
  const ct = args.contentType.split(";")[0].trim() || "application/octet-stream";
  const useMultipart = args.buf.byteLength >= MEDIA_RENDER_MULTIPART_THRESHOLD_BYTES;
  await withOssRetry("media-render-upload", async () => {
    await ossUploadBuffer(client, {
      key: args.key,
      buf: args.buf,
      contentType: ct,
      useMultipart,
      timeoutMs: MEDIA_RENDER_UPLOAD_TIMEOUT_MS,
      multipartParallel: 2,
    });
  });
  return publicUrlForKey(args.cfg, args.key, args.preferBucketUrl);
}

/** 从本地文件流式上传，避免大文件整段读入内存并在上传阶段回传进度 */
export async function uploadMediaRenderOutputFromPath(args: {
  userId: string;
  jobId: string;
  filePath: string;
  tier?: "ephemeral" | "pinned";
  onUploadProgress?: (ratio: number) => void;
}): Promise<{ url: string; bytesOut: number; posterUrl?: string }> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const fileStat = await stat(args.filePath);
  const bytesOut = fileStat.size;
  const key =
    args.tier === "pinned"
      ? buildMediaRenderPinnedKey(args.userId, args.jobId)
      : buildMediaRenderEphemeralKey(args.userId, args.jobId);
  const url = await uploadFilePathToOss({
    cfg: cfgRaw,
    key,
    filePath: args.filePath,
    bytesOut,
    contentType: "video/mp4",
    preferBucketUrl: true,
    onUploadProgress: args.onUploadProgress,
  });
  return { url, bytesOut, posterUrl: undefined };
}

/** 上传自动剪辑成片封面（JPEG） */
export async function uploadMediaRenderPosterFromBuffer(args: {
  userId: string;
  jobId: string;
  buf: Buffer;
  tier?: "ephemeral" | "pinned";
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key =
    args.tier === "pinned"
      ? buildMediaRenderPinnedPosterKey(args.userId, args.jobId)
      : buildMediaRenderEphemeralPosterKey(args.userId, args.jobId);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: "image/jpeg",
    preferBucketUrl: true,
  });
}

export async function uploadMediaRenderOutput(args: {
  userId: string;
  jobId: string;
  buf: Buffer;
  tier?: "ephemeral" | "pinned";
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const key =
    args.tier === "pinned"
      ? buildMediaRenderPinnedKey(args.userId, args.jobId)
      : buildMediaRenderEphemeralKey(args.userId, args.jobId);
  return uploadBufferToOss({
    cfg: cfgRaw,
    key,
    buf: args.buf,
    contentType: "video/mp4",
    preferBucketUrl: true,
  });
}

async function uploadFilePathToOss(args: {
  cfg: OssEnvConfig;
  key: string;
  filePath: string;
  bytesOut: number;
  contentType: string;
  preferBucketUrl?: boolean;
  onUploadProgress?: (ratio: number) => void;
}): Promise<string> {
  const client = await createOssClientFrom(args.cfg, {
    timeoutMs: MEDIA_RENDER_UPLOAD_TIMEOUT_MS,
  });
  const ct = args.contentType.split(";")[0].trim() || "application/octet-stream";
  const useMultipart = args.bytesOut >= MEDIA_RENDER_MULTIPART_THRESHOLD_BYTES;

  await withOssRetry("media-render-upload-file", async () => {
    if (useMultipart) {
      await (client as unknown as OssMultipartPathClient).multipartUpload(
        args.key,
        args.filePath,
        {
          parallel: 2,
          partSize: MEDIA_RENDER_MULTIPART_PART_SIZE,
          timeout: MEDIA_RENDER_UPLOAD_TIMEOUT_MS,
          mime: ct,
          progress: (ratio) => {
            if (Number.isFinite(ratio) && ratio >= 0) {
              args.onUploadProgress?.(Math.min(1, ratio));
            }
          },
          headers: {
            "Content-Type": ct,
            "x-oss-object-acl": "public-read",
          },
        },
      );
      return;
    }
    const stream = createReadStream(args.filePath);
    await client.put(args.key, stream as unknown as Buffer, {
      headers: { "Content-Type": ct },
      ACL: "public-read",
    });
    args.onUploadProgress?.(1);
  });

  return publicUrlForKey(args.cfg, args.key, args.preferBucketUrl);
}

/** 将 ephemeral 对象 copy 到 pinned 路径（同 bucket） */
export async function copyMediaRenderToPinned(args: {
  sourceUrl: string;
  userId: string;
  jobId: string;
}): Promise<string> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new Error(cfgRaw.error);
  }
  const sourceKey = extractManagedOssObjectKey(args.sourceUrl, cfgRaw);
  if (!sourceKey) {
    throw new Error("无法解析成片 OSS 地址");
  }
  const destKey = buildMediaRenderPinnedKey(args.userId, args.jobId);
  const r = await fetch(args.sourceUrl);
  if (!r.ok) {
    throw new Error(`fetch source: HTTP ${r.status}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return uploadBufferToOss({
    cfg: cfgRaw,
    key: destKey,
    buf,
    contentType: r.headers.get("content-type") ?? "video/mp4",
    preferBucketUrl: true,
  });
}
