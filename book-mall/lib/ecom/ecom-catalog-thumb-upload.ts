import {
  buildEcomFullBodyLibraryThumbOssKey,
  buildEcomGarmentLibraryThumbOssKey,
  buildEcomModelLibraryThumbOssKey,
  buildEcomPoseLibraryThumbOssKey,
} from "@/lib/canvas/canvas-constants";
import { uploadEcomCatalogThumbWebp } from "@/lib/canvas/canvas-oss";
import { buildEcomGalleryThumbWebp } from "@/lib/ecom/ecom-gallery-thumb";
import type { GlobalAssetCatalogKind } from "@/lib/ecom/ecom-global-asset-catalog";

export type CatalogThumbKind = GlobalAssetCatalogKind;

export function buildCatalogThumbOssKey(catalogKind: CatalogThumbKind, id: string): string {
  switch (catalogKind) {
    case "pose":
      return buildEcomPoseLibraryThumbOssKey(id);
    case "avatar":
      return buildEcomModelLibraryThumbOssKey(id);
    case "garment":
      return buildEcomGarmentLibraryThumbOssKey(id);
    case "full-body":
      return buildEcomFullBodyLibraryThumbOssKey(id);
    default: {
      const _exhaustive: never = catalogKind;
      throw new Error(`不支持的 catalogKind: ${_exhaustive}`);
    }
  }
}

/** 缩略图缺失或与主图相同（未生成独立 thumb） */
export function isCatalogThumbStale(
  thumbUrl: string | null | undefined,
  ossUrl: string | null | undefined,
): boolean {
  const thumb = thumbUrl?.trim() ?? "";
  const oss = ossUrl?.trim() ?? "";
  if (!oss) return false;
  if (!thumb) return true;
  if (thumb === oss) return true;
  return false;
}

export async function generateAndUploadCatalogThumb(args: {
  catalogKind: CatalogThumbKind;
  id: string;
  sourceBuf: Buffer;
}): Promise<string> {
  const thumbBuf = await buildEcomGalleryThumbWebp(args.sourceBuf);
  const key = buildCatalogThumbOssKey(args.catalogKind, args.id);
  return uploadEcomCatalogThumbWebp({ key, buf: thumbBuf });
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url.trim());
  if (!res.ok) throw new Error(`下载图片失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("图片内容为空");
  return buf;
}

export async function generateAndUploadCatalogThumbFromUrl(args: {
  catalogKind: CatalogThumbKind;
  id: string;
  imageUrl: string;
}): Promise<string> {
  const sourceBuf = await fetchImageBuffer(args.imageUrl);
  return generateAndUploadCatalogThumb({
    catalogKind: args.catalogKind,
    id: args.id,
    sourceBuf,
  });
}
