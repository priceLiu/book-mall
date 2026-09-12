import sharp from "sharp";

function parseDataUrl(dataUrl: string): Buffer {
  const m = /^data:[^;]+;base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("无效蒙版 data URL");
  return Buffer.from(m[2], "base64");
}

async function readImageBuffer(image: string): Promise<Buffer> {
  const trimmed = image.trim();
  if (trimmed.startsWith("data:")) return parseDataUrl(trimmed);
  const res = await fetch(trimmed, {
    method: "GET",
    signal: AbortSignal.timeout(45_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`读取蒙版失败 HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 万相局部重绘：蒙版须与底图同分辨率，白色=重绘区；二值化软边笔刷 */
export async function normalizeInpaintMaskBuffer(
  maskInput: string,
  targetWidth: number,
  targetHeight: number,
): Promise<Buffer> {
  if (!targetWidth || !targetHeight) {
    throw new Error("无法确定底图尺寸以校验蒙版");
  }
  const buf = await readImageBuffer(maskInput);
  return sharp(buf, { failOn: "none" })
    .resize(targetWidth, targetHeight, { fit: "fill" })
    .greyscale()
    .threshold(128)
    .png()
    .toBuffer();
}

export async function normalizeInpaintMaskDataUrl(
  maskInput: string,
  targetWidth: number,
  targetHeight: number,
): Promise<string> {
  const out = await normalizeInpaintMaskBuffer(maskInput, targetWidth, targetHeight);
  return `data:image/png;base64,${out.toString("base64")}`;
}

export async function readImagePixelSize(image: string): Promise<{
  width: number;
  height: number;
}> {
  const buf = await readImageBuffer(image);
  const meta = await sharp(buf, { failOn: "none" }).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("无法读取底图尺寸");
  }
  return { width: meta.width, height: meta.height };
}
