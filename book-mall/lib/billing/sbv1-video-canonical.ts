/**
 * sbv1 视频展示变体 → 财务分档 canonicalModelKey（积分换算 1.0）
 */
const SBV1_VARIANT_TO_CANONICAL: Record<string, string> = {
  "seedance-2-720p-real": "seedance-2.0-720p-real",
  "seedance-2-720p-audio-real": "seedance-2.0-720p-real",
  "seedance-2-fast-720p-real": "seedance-2.0-fast-720p-real",
  "seedance-2-1080p-real": "seedance-2.0-1080p-real",
  "seedance-15-pro-1080p-real": "seedance-pro-1080p",
};

/** sbv1 节点 volcengineVariantId → B 表 canonical（未命中则 null） */
export function sbv1VideoCanonicalKey(variantId: string | null | undefined): string | null {
  const v = variantId?.trim();
  if (!v) return null;
  return SBV1_VARIANT_TO_CANONICAL[v] ?? null;
}

/** 按 engine params 推断分档（兜底） */
export function sbv1VideoCanonicalFromParams(input: {
  modelKey?: string | null;
  resolution?: string | null;
  tier?: string | null;
}): string | null {
  const mk = input.modelKey?.trim() ?? "";
  const res = (input.resolution ?? "720p").toLowerCase();
  const tier = (input.tier ?? "").toLowerCase();

  if (mk.includes("seedance-1.5") || mk.includes("1.5-pro")) {
    return res.includes("1080") ? "seedance-pro-1080p" : "seedance-pro-720p";
  }
  if (!mk.includes("seedance")) return null;

  if (tier === "fast") return "seedance-2.0-fast-720p-real";
  if (res.includes("1080")) return "seedance-2.0-1080p-real";
  return "seedance-2.0-720p-real";
}
