import { ensureDashscopeImageUrl } from "@/lib/ecom/ecom-dashscope-image-normalize";
import { tightenVtonGarmentUrlIfNeeded } from "@/lib/ecom/ecom-vton/garment-crop-normalize";

/** 批量试衣：同一 garmentUrl 只 tighten + dashscope 规范化一次 */
export type VtonGarmentPrepareCache = Map<string, string>;

export async function prepareVtonGarmentUrlForTryon(opts: {
  userId: string;
  garmentUrl: string;
  cache?: VtonGarmentPrepareCache;
}): Promise<string> {
  const source = opts.garmentUrl.trim();
  if (!source) throw new Error("缺少服装参考图");

  const cached = opts.cache?.get(source);
  if (cached) return cached;

  const tightened = await tightenVtonGarmentUrlIfNeeded({
    userId: opts.userId,
    garmentUrl: source,
  });
  const normalized = await ensureDashscopeImageUrl({
    userId: opts.userId,
    imageUrl: tightened,
  });
  opts.cache?.set(source, normalized.url);
  return normalized.url;
}
