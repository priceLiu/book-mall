import sharp from "sharp";

/** 与 e-commerce-toolkit/lib/ecom-oss-image-url.ts ECOM_OSS_THUMB_WIDTH 对齐 */
export const ECOM_GALLERY_THUMB_WIDTH = 480;

/** 导入 OSS 前：生成列表用 WebP 缩略图（固定宽，等比缩放） */
export async function buildEcomGalleryThumbWebp(source: Buffer): Promise<Buffer> {
  return sharp(source, { failOn: "none" })
    .rotate()
    .resize({
      width: ECOM_GALLERY_THUMB_WIDTH,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
}
