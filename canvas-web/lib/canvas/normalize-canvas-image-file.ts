/** 画布粘贴/预览 · 浏览器端解码并规范为 JPEG（PC 大图 PNG 的 canvas.toBlob('png') 易失败） */

const JPEG_QUALITY = 0.92;
const MAX_EDGE_PX = 8192;

function baseName(name: string): string {
  const trimmed = name.trim() || "image";
  return trimmed.replace(/\.[^.]+$/, "") || "image";
}

function ensureJpegFileName(name: string): string {
  return `${baseName(name)}.jpg`;
}

function isPngLike(file: File): boolean {
  const t = file.type.toLowerCase();
  return t === "image/png" || t === "image/x-png" || /\.png$/i.test(file.name);
}

function isJpegLike(file: File): boolean {
  const t = file.type.toLowerCase();
  return t === "image/jpeg" || t === "image/jpg" || /\.jpe?g$/i.test(file.name);
}

async function convertViaCanvas(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    let { width, height } = bitmap;
    if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布上下文");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片编码失败"))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
    return new File([blob], ensureJpegFileName(file.name), {
      type: "image/jpeg",
    });
  } finally {
    bitmap.close();
  }
}

/**
 * 预览 / 粘贴用：解码后输出 JPEG（上传本身由服务端 sharp 处理，可不经过此函数）。
 */
export async function normalizeCanvasImageFile(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.size) throw new Error("图片文件为空");

  if (isJpegLike(file)) {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      if (file.type === "image/jpeg") return file;
      return new File([file], ensureJpegFileName(file.name), {
        type: "image/jpeg",
      });
    } catch {
      return convertViaCanvas(file);
    }
  }

  if (isPngLike(file) || file.type.startsWith("image/") || !file.type) {
    try {
      return await convertViaCanvas(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`无法识别图片格式：${msg}`);
    }
  }

  try {
    return await convertViaCanvas(file);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`无法识别图片格式：${msg}`);
  }
}

/** 上传前补全文件名 / MIME，便于服务端识别（Windows 空 type） */
export function ensureCanvasUploadFileMeta(file: File): File {
  const name = file.name.trim() || (isPngLike(file) ? "upload.png" : "upload.jpg");
  const type = file.type.toLowerCase();
  if (type.startsWith("image/")) {
    if (file.name.trim()) return file;
    return new File([file], name, { type: file.type });
  }
  if (/\.png$/i.test(name)) {
    return new File([file], name, { type: "image/png" });
  }
  if (/\.jpe?g$/i.test(name)) {
    return new File([file], name, { type: "image/jpeg" });
  }
  if (isPngLike(file)) {
    return new File([file], name.endsWith(".png") ? name : `${name}.png`, {
      type: "image/png",
    });
  }
  return new File([file], ensureJpegFileName(name), { type: "image/jpeg" });
}

export async function normalizeCanvasImageFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    out.push(await normalizeCanvasImageFile(file));
  }
  return out;
}
