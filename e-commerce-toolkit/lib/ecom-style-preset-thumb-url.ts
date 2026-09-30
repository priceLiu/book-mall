import type { EcomStylePreset } from "@/lib/ecom-style-preset-types";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";

/** 版式库列表缩略：预生成 `-thumb.webp` 直链，否则 OSS 动态缩略 */
export function ecomStylePresetDisplayThumbUrl(p: EcomStylePreset): string | undefined {
  const raw = p.thumbUrl?.trim();
  if (!raw) return undefined;
  if (/-thumb\.(webp|png|jpe?g)(\?|$)/i.test(raw)) {
    return raw.split("?")[0] ?? raw;
  }
  return buildEcomOssThumbUrl(raw);
}
