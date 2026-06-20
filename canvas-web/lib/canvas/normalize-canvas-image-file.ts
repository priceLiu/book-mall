/** 画布上传/粘贴 · 将任意可解码图片规范为 JPEG/PNG（兼容 Windows 剪贴板空 MIME） */

const JPEG_QUALITY = 0.92;

function baseName(name: string): string {
  const trimmed = name.trim() || "image";
  return trimmed.replace(/\.[^.]+$/, "") || "image";
}

function ensureImageFileName(name: string, ext: ".jpg" | ".png"): string {
  return `${baseName(name)}${ext}`;
}

async function convertViaCanvas(
  file: File,
  mime: "image/jpeg" | "image/png",
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布上下文");
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片编码失败"))),
        mime,
        mime === "image/jpeg" ? JPEG_QUALITY : undefined,
      );
    });
    const ext = mime === "image/png" ? ".png" : ".jpg";
    return new File([blob], ensureImageFileName(file.name, ext), { type: mime });
  } finally {
    bitmap.close();
  }
}

/** 浏览器端：解码失败则抛错；成功则输出 JPEG 或保留 PNG */
export async function normalizeCanvasImageFile(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.size) throw new Error("图片文件为空");

  const type = file.type.toLowerCase();
  if (type === "image/png") {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      return new File([file], ensureImageFileName(file.name, ".png"), {
        type: "image/png",
      });
    } catch {
      return convertViaCanvas(file, "image/png");
    }
  }

  if (type === "image/jpeg" || type === "image/jpg") {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      return new File([file], ensureImageFileName(file.name, ".jpg"), {
        type: "image/jpeg",
      });
    } catch {
      return convertViaCanvas(file, "image/jpeg");
    }
  }

  try {
    return await convertViaCanvas(file, "image/jpeg");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`无法识别图片格式：${msg}`);
  }
}

export async function normalizeCanvasImageFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    out.push(await normalizeCanvasImageFile(file));
  }
  return out;
}
