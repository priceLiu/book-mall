import sharp from "sharp";

/** 画布用户上传 / 人像入库 · 规范为 JPEG 或 PNG（火山 CreateAsset 等不接受 WebP/BMP） */
export async function normalizeCanvasUploadImageBuffer(
  buf: Buffer,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height || !meta.format) {
    throw new Error("无法识别图片格式");
  }
  if (meta.format === "jpeg") {
    return { buf, contentType: "image/jpeg", ext: "jpg" };
  }
  if (meta.format === "png") {
    return { buf, contentType: "image/png", ext: "png" };
  }
  const jpeg = await sharp(buf).jpeg({ quality: 92 }).toBuffer();
  return { buf: jpeg, contentType: "image/jpeg", ext: "jpg" };
}

export function inferCanvasUploadImageMime(
  mime: string,
  fileName: string,
): string {
  const lowerMime = mime.toLowerCase();
  if (lowerMime.startsWith("image/")) return lowerMime;
  const lowerName = fileName.toLowerCase();
  if (/\.(jpe?g)$/.test(lowerName)) return "image/jpeg";
  if (/\.png$/.test(lowerName)) return "image/png";
  if (/\.webp$/.test(lowerName)) return "image/webp";
  if (/\.gif$/.test(lowerName)) return "image/gif";
  if (/\.bmp$/.test(lowerName)) return "image/bmp";
  if (/\.tiff?$/.test(lowerName)) return "image/tiff";
  return lowerMime;
}
