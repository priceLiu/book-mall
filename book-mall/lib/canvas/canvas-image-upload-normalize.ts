import sharp from "sharp";

const MAX_EDGE_PX = 8192;

/** 无 MIME / 扩展名时按文件头识别（Windows 常见空 type） */
export function sniffImageMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buf.length >= 6 &&
    (buf.toString("ascii", 0, 6) === "GIF87a" ||
      buf.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "image/gif";
  }
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return "image/bmp";
  }
  return null;
}

export function inferCanvasUploadImageMime(
  mime: string,
  fileName: string,
): string {
  const lowerMime = mime.toLowerCase();
  if (lowerMime === "image/x-png") return "image/png";
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

function buildSharpPipeline(buf: Buffer) {
  let image = sharp(buf, { failOn: "none" }).rotate();
  return image;
}

/**
 * 画布上传 · 统一转 JPEG（PNG 透明铺白底），并限制最大边长。
 * 避免 PC 端 PNG 直传 / sharp 直通失败；与 JPG 走同一成功路径。
 */
export async function normalizeCanvasUploadImageBuffer(
  buf: Buffer,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  let pipeline = buildSharpPipeline(buf);
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height || !meta.format) {
    throw new Error("无法识别图片格式");
  }

  if (
    (meta.width ?? 0) > MAX_EDGE_PX ||
    (meta.height ?? 0) > MAX_EDGE_PX
  ) {
    pipeline = pipeline.resize({
      width: MAX_EDGE_PX,
      height: MAX_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (meta.format === "jpeg") {
    const out = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    return { buf: out, contentType: "image/jpeg", ext: "jpg" };
  }

  const out = await pipeline
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return { buf: out, contentType: "image/jpeg", ext: "jpg" };
}
