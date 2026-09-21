import sharp from "sharp";

import { normalizeCanvasUploadImageBuffer } from "@/lib/canvas/canvas-image-upload-normalize";

import {
  prepareWan27ReferenceBuffer,
  wan27ReferenceNeedsPrepare,
} from "./ecom-dashscope-image-normalize";

import type { ProductDesignReferenceRole } from "./ecom-product-design-types";

/** 产品实拍等默认上传上限 */
export const PRODUCT_DESIGN_REF_UPLOAD_MAX_BYTES_DEFAULT = 30 * 1024 * 1024;
/** 主图/详情页风格参考（长图）允许更大原文件 */
export const PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;
/** OSS 持久化上限（视觉/生图下发仍经 Gateway 按模型再压缩） */
export const PRODUCT_DESIGN_REF_STORE_MAX_BYTES = 30 * 1024 * 1024;

/** wan2.7 多图参考 / 百炼垫图：宽高均须 ≥240px */
export const PRODUCT_DESIGN_REF_MIN_WIDTH = 240;
export const PRODUCT_DESIGN_REF_MIN_HEIGHT = 240;

async function normalizeBufferForWan27Refs(
  buf: Buffer,
  contentType: string,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const meta = await sharp(buf, { failOn: "none" }).rotate().metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error("无法读取图片尺寸，请换一张图片重试");
  }
  if (!wan27ReferenceNeedsPrepare(w, h, buf.length)) {
    const ext =
      contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    return { buf, contentType, ext };
  }
  const out = await prepareWan27ReferenceBuffer(buf);
  return { buf: out, contentType: "image/jpeg", ext: "jpg" };
}

export function getProductDesignRefUploadMaxBytes(role: ProductDesignReferenceRole): number {
  if (role === "main-style" || role === "detail-style") {
    return PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX_BYTES;
  }
  return PRODUCT_DESIGN_REF_UPLOAD_MAX_BYTES_DEFAULT;
}

async function compressToStoreLimit(
  buf: Buffer,
  contentType: string,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  let quality = 90;
  for (let attempt = 0; attempt < 8; attempt++) {
    const meta = await sharp(buf, { failOn: "none" }).rotate().metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    let pipeline = sharp(buf, { failOn: "none" }).rotate();
    const maxEdge = Math.max(w, h);
    if (maxEdge > 8192) {
      pipeline = pipeline.resize({
        width: 8192,
        height: 8192,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    const out = await pipeline
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= PRODUCT_DESIGN_REF_STORE_MAX_BYTES) {
      return { buf: out, contentType: "image/jpeg", ext: "jpg" };
    }
    quality = Math.max(52, quality - 8);
  }
  throw new Error(
    "图片压缩后仍超过 30MB，请换用更短的长图或降低分辨率后重试",
  );
}

/** 上传后规范化并压至 OSS 存储上限以内 */
export async function normalizeProductDesignReferenceForStorage(
  buf: Buffer,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  if (buf.byteLength === 0) {
    throw new Error("空文件");
  }
  const normalized = await normalizeCanvasUploadImageBuffer(buf);
  const withMinSize = await normalizeBufferForWan27Refs(
    normalized.buf,
    normalized.contentType,
  );
  if (withMinSize.buf.length <= PRODUCT_DESIGN_REF_STORE_MAX_BYTES) {
    return withMinSize;
  }
  const compressed = await compressToStoreLimit(withMinSize.buf, withMinSize.contentType);
  return normalizeBufferForWan27Refs(compressed.buf, compressed.contentType);
}
