import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { normalizeCanvasUploadImageBuffer } from "@/lib/canvas/canvas-image-upload-normalize";

function isHttpsUrl(u: string): boolean {
  return /^https:\/\//.test(u.trim());
}

/** 火山 CreateAsset 需要 JPEG/PNG；WebP/BMP 等先转码再上传 OSS */
export async function ensureVolcenginePortraitImageUrl(opts: {
  userId: string;
  imageUrl: string;
}): Promise<string> {
  const imageUrl = opts.imageUrl.trim();
  if (!isHttpsUrl(imageUrl)) {
    throw new Error("入库图片须为公网 HTTPS URL");
  }

  const pathname = new URL(imageUrl).pathname.toLowerCase();
  if (/\.(jpe?g|png)$/.test(pathname)) {
    return imageUrl;
  }

  const res = await fetch(imageUrl, { method: "GET" });
  if (!res.ok) {
    throw new Error(`下载入库图片失败 HTTP ${res.status}`);
  }
  const raw = Buffer.from(await res.arrayBuffer());
  const normalized = await normalizeCanvasUploadImageBuffer(raw);
  return uploadCanvasUserBuffer({
    userId: opts.userId,
    buf: normalized.buf,
    contentType: normalized.contentType,
    ext: normalized.ext,
    preferBucketUrl: true,
  });
}
