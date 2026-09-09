import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import type { VtonModelBodyShotType } from "@/lib/ecom/ecom-vton/types";

/** 与 wan2.7 竖向 2K 出图一致，便于模型理解全身留白 */
export const VTon_FULL_BODY_EXPAND_CANVAS_W = 960;
export const VTon_FULL_BODY_EXPAND_CANVAS_H = 1696;

export type VtonFullBodyExpandRefLayout =
  | { mode: "original" }
  | {
      mode: "canvas";
      /** 参考图在画布上允许占的最大高度比 */
      maxHeightRatio: number;
      maxWidthRatio: number;
      topPaddingRatio: number;
      /** 纵向偏长参考（AI 长脸 / 窄图） */
      elongated: boolean;
    };

/**
 * 头像/半身扩全身：先把参考图缩小放到 9:16 白底顶部，避免 wan2.7 按特写尺寸向下补身体。
 */
export function resolveVtonFullBodyExpandRefLayout(
  shotType: VtonModelBodyShotType,
  width: number,
  height: number,
): VtonFullBodyExpandRefLayout {
  if (shotType === "full_body") {
    return { mode: "original" };
  }

  const aspect = height / width;
  const elongated =
    aspect >= 1.28 ||
    (shotType === "portrait" && aspect >= 1.12) ||
    (shotType === "unknown" && aspect >= 1.2);

  if (shotType === "half_body") {
    return {
      mode: "canvas",
      maxHeightRatio: 0.28,
      maxWidthRatio: 0.5,
      topPaddingRatio: 0.012,
      elongated: false,
    };
  }

  if (elongated) {
    return {
      mode: "canvas",
      maxHeightRatio: 0.13,
      maxWidthRatio: 0.3,
      topPaddingRatio: 0.028,
      elongated: true,
    };
  }

  return {
    mode: "canvas",
    maxHeightRatio: shotType === "portrait" ? 0.15 : 0.17,
    maxWidthRatio: 0.36,
    topPaddingRatio: 0.02,
    elongated: false,
  };
}

export async function buildVtonFullBodyExpandRefCanvas(opts: {
  userId: string;
  portraitUrl: string;
  shotType: VtonModelBodyShotType;
}): Promise<{ refUrl: string; layout: VtonFullBodyExpandRefLayout }> {
  const portraitUrl = opts.portraitUrl.trim();
  const res = await fetch(portraitUrl);
  if (!res.ok) {
    throw new Error(`下载模特参考图失败 HTTP ${res.status}`);
  }
  const input = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error("无法读取模特参考图尺寸");
  }

  const layout = resolveVtonFullBodyExpandRefLayout(opts.shotType, w, h);
  if (layout.mode === "original") {
    return { refUrl: portraitUrl, layout };
  }

  const maxW = Math.floor(VTon_FULL_BODY_EXPAND_CANVAS_W * layout.maxWidthRatio);
  const maxH = Math.floor(VTon_FULL_BODY_EXPAND_CANVAS_H * layout.maxHeightRatio);
  const scale = Math.min(maxW / w, maxH / h);
  const newW = Math.max(1, Math.round(w * scale));
  const newH = Math.max(1, Math.round(h * scale));

  const resized = await sharp(input).resize(newW, newH, { fit: "fill" }).png().toBuffer();
  const top = Math.floor(VTon_FULL_BODY_EXPAND_CANVAS_H * layout.topPaddingRatio);
  const left = Math.floor((VTon_FULL_BODY_EXPAND_CANVAS_W - newW) / 2);

  const out = await sharp({
    create: {
      width: VTon_FULL_BODY_EXPAND_CANVAS_W,
      height: VTon_FULL_BODY_EXPAND_CANVAS_H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();

  const refUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "png",
    buf: out,
    contentType: "image/png",
  });

  return { refUrl, layout };
}
