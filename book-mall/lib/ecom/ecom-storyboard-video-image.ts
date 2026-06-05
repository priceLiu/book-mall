import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

/** 火山 Seedance 图生视频：宽高比须在 [0.40, 2.50]（宽/高） */
const VOLCENGINE_VIDEO_AR_MIN = 0.4;
const VOLCENGINE_VIDEO_AR_MAX = 2.48;

/**
 * 完整分镜 PNG 常为超宽横图（≈2.51），超出方舟上限。
 * 必要时以白边填充至合法比例后再提交视频任务。
 */
export async function normalizeImageForVolcengineVideo(opts: {
  userId: string;
  imageUrl: string;
}): Promise<{ url: string; normalized: boolean }> {
  const imageUrl = opts.imageUrl.trim();
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`下载分镜图失败 HTTP ${res.status}`);
  }
  const input = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error("无法读取分镜图尺寸");
  }

  const ar = w / h;
  if (ar >= VOLCENGINE_VIDEO_AR_MIN && ar <= VOLCENGINE_VIDEO_AR_MAX) {
    return { url: imageUrl, normalized: false };
  }

  let targetW = w;
  let targetH = h;
  if (ar > VOLCENGINE_VIDEO_AR_MAX) {
    targetH = Math.ceil(w / VOLCENGINE_VIDEO_AR_MAX);
  } else if (ar < VOLCENGINE_VIDEO_AR_MIN) {
    targetW = Math.ceil(h * VOLCENGINE_VIDEO_AR_MIN);
  }

  const padTop = Math.max(0, Math.floor((targetH - h) / 2));
  const padBottom = Math.max(0, targetH - h - padTop);
  const padLeft = Math.max(0, Math.floor((targetW - w) / 2));
  const padRight = Math.max(0, targetW - w - padLeft);

  const out = await sharp(input)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  const url = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "png",
    buf: out,
    contentType: "image/png",
  });

  return { url, normalized: true };
}
