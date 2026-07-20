/**
 * 统计 OSS Bucket 内图片 / 视频对象数量（按 Content-Type 与扩展名粗分）。
 * 用法：cd book-mall && pnpm exec tsx scripts/audit-oss-media-count.ts
 */
import { createOssClientFrom, readOssEnv } from "../lib/oss-client";

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".heic",
  ".heif",
]);
const VIDEO_EXT = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
  ".mkv",
  ".m4v",
  ".flv",
]);

function extOf(key: string): string {
  const i = key.lastIndexOf(".");
  return i >= 0 ? key.slice(i).toLowerCase() : "";
}

function isImageKey(key: string, contentType?: string): boolean {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("image/")) return true;
  return IMAGE_EXT.has(extOf(key));
}

function isVideoKey(key: string, contentType?: string): boolean {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  return VIDEO_EXT.has(extOf(key));
}

async function main() {
  const cfg = readOssEnv();
  if ("error" in cfg) {
    console.error(cfg.error);
    process.exit(1);
  }

  const client = await createOssClientFrom(cfg, { timeoutMs: 120_000 });
  let continuationToken: string | undefined;
  let totalObjects = 0;
  let imageCount = 0;
  let videoCount = 0;
  let otherCount = 0;

  do {
    const page = await client.listV2({
      "max-keys": 1000,
      ...(continuationToken ? { "continuation-token": continuationToken } : {}),
    });
    for (const obj of page.objects ?? []) {
      totalObjects += 1;
      const key = obj.name ?? "";
      const ct =
        typeof (obj as { type?: string }).type === "string"
          ? (obj as { type?: string }).type
          : undefined;
      if (isImageKey(key, ct)) imageCount += 1;
      else if (isVideoKey(key, ct)) videoCount += 1;
      else otherCount += 1;
    }
    continuationToken = page.nextContinuationToken;
  } while (continuationToken);

  console.log(
    JSON.stringify(
      {
        provider: "Aliyun OSS (ali-oss SDK)",
        region: cfg.region,
        bucket: cfg.bucket,
        endpoint: cfg.endpoint ?? "(default from region)",
        totalObjects,
        images: imageCount,
        videos: videoCount,
        other: otherCount,
        note: "Counts all objects in bucket; images/videos inferred from Content-Type or file extension.",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
