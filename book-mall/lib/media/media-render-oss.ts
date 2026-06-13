import {
  createOssClientFrom,
  readOssEnv,
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

async function uploadBufferToOss(args: {
  cfg: OssEnvConfig;
  key: string;
  buf: Buffer;
  contentType: string;
  preferBucketUrl?: boolean;
}): Promise<string> {
  const client = await createOssClientFrom(args.cfg);
  const ct = args.contentType.split(";")[0].trim() || "application/octet-stream";
  await client.put(args.key, args.buf, {
    headers: { "Content-Type": ct },
    ACL: "public-read",
  });
  return publicUrlForKey(args.cfg, args.key, args.preferBucketUrl);
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
