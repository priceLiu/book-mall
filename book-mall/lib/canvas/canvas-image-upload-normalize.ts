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
 * 画布上传 · 限制最大边长后规范化：
 * - JPEG 直接重编码 JPEG；
 * - 带透明像素的图（PNG/WebP 等）裁掉四周透明留白后保留透明输出 PNG（不铺白底、无暗边）；
 * - 不透明图铺白底转 JPEG（兼容 PC 端 PNG 直传 / sharp 直通失败）。
 */
export async function normalizeCanvasUploadImageBuffer(
  buf: Buffer,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const meta = await buildSharpPipeline(buf).metadata();
  if (!meta.width || !meta.height || !meta.format) {
    throw new Error("无法识别图片格式");
  }

  const needResize =
    (meta.width ?? 0) > MAX_EDGE_PX || (meta.height ?? 0) > MAX_EDGE_PX;
  /** 每次重建管道，避免 sharp 实例被 toBuffer 消费后复用失败 */
  const buildResized = () => {
    let p = buildSharpPipeline(buf);
    if (needResize) {
      p = p.resize({
        width: MAX_EDGE_PX,
        height: MAX_EDGE_PX,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    return p;
  };

  if (meta.format === "jpeg") {
    const out = await buildResized().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    return { buf: Buffer.from(out), contentType: "image/jpeg", ext: "jpg" };
  }

  // 透明图（带 alpha 且实际使用了透明）：裁掉四周透明留白后保留透明输出 PNG，
  // 避免铺白底产生白边、也避免透明留白在画布上显示为暗边。
  if (meta.hasAlpha) {
    let isOpaque = false;
    try {
      isOpaque = (await sharp(buf, { failOn: "none" }).stats()).isOpaque;
    } catch {
      isOpaque = false;
    }
    if (!isOpaque) {
      try {
        const out = await buildResized()
          .trim({ threshold: 10 })
          .png({ compressionLevel: 9 })
          .toBuffer();
        return { buf: Buffer.from(out), contentType: "image/png", ext: "png" };
      } catch {
        // 全透明 / 裁剪失败 → 不裁剪，仍保留透明
        const out = await buildResized().png({ compressionLevel: 9 }).toBuffer();
        return { buf: Buffer.from(out), contentType: "image/png", ext: "png" };
      }
    }
  }

  const out = await buildResized()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return { buf: Buffer.from(out), contentType: "image/jpeg", ext: "jpg" };
}
