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

function ensurePngFileName(name: string): string {
  return `${baseName(name)}.png`;
}

function isPngLike(file: File): boolean {
  const t = file.type.toLowerCase();
  return t === "image/png" || t === "image/x-png" || /\.png$/i.test(file.name);
}

function isJpegLike(file: File): boolean {
  const t = file.type.toLowerCase();
  return t === "image/jpeg" || t === "image/jpg" || /\.jpe?g$/i.test(file.name);
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/png",
  name: string,
): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b
          ? resolve(new File([b], name, { type }))
          : reject(new Error("图片编码失败")),
      type,
      type === "image/jpeg" ? JPEG_QUALITY : undefined,
    );
  });
}

/** 采样判断是否含有效透明像素（透明 PNG / WebP 等），避免给透明图铺白底产生白边 */
function sourceHasAlpha(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
): boolean {
  const sample = 160;
  const scale = Math.min(1, sample / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, w, h);
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** 透明图四周留白的内容边界（占比 0~1）；无明显留白 / 全透明返回 null */
function contentBounds(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
): { l: number; t: number; r: number; b: number } | null {
  const sample = 1024;
  const scale = Math.min(1, sample / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const l = minX / w;
  const t = minY / h;
  const r = (maxX + 1) / w;
  const b = (maxY + 1) / h;
  if (l <= 0.005 && t <= 0.005 && r >= 0.995 && b >= 0.995) return null;
  return { l, t, r, b };
}

async function convertViaCanvas(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const natW = bitmap.width;
    const natH = bitmap.height;
    let outW = natW;
    let outH = natH;
    if (natW > MAX_EDGE_PX || natH > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / Math.max(natW, natH);
      outW = Math.max(1, Math.round(natW * scale));
      outH = Math.max(1, Math.round(natH * scale));
    }

    if (sourceHasAlpha(bitmap, natW, natH)) {
      // 透明图：裁掉四周透明留白后保留透明输出 PNG（无白边 / 无暗边）
      const bounds = contentBounds(bitmap, natW, natH);
      const sx = bounds ? Math.floor(bounds.l * natW) : 0;
      const sy = bounds ? Math.floor(bounds.t * natH) : 0;
      const sw = bounds ? Math.max(1, Math.ceil(bounds.r * natW) - sx) : natW;
      const sh = bounds ? Math.max(1, Math.ceil(bounds.b * natH) - sy) : natH;
      const cw = Math.max(1, Math.round(sw * (outW / natW)));
      const ch = Math.max(1, Math.round(sh * (outH / natH)));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法创建画布上下文");
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, cw, ch);
      try {
        return await canvasToFile(
          canvas,
          "image/png",
          ensurePngFileName(file.name),
        );
      } catch {
        // 大图 PNG 编码失败 → 退回铺白底 JPEG（透明区域填白）
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = "source-over";
        return canvasToFile(canvas, "image/jpeg", ensureJpegFileName(file.name));
      }
    }

    // 不透明图：铺白底转 JPEG（兼容 PC 大图 toBlob('png') 失败）
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布上下文");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(bitmap, 0, 0, outW, outH);
    return canvasToFile(canvas, "image/jpeg", ensureJpegFileName(file.name));
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
