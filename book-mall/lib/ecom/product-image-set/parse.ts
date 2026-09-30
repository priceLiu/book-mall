import {
  DEFAULT_PRODUCT_IMAGE_SET_SETTINGS,
  type ProductImageSetMeta,
  type ProductImageSetOutput,
  type ProductImageSetReference,
  type ProductImageSetSettings,
} from "./types";

export function parseSettings(raw: unknown): ProductImageSetSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PRODUCT_IMAGE_SET_SETTINGS };
  const o = raw as Record<string, unknown>;
  const base = DEFAULT_PRODUCT_IMAGE_SET_SETTINGS;
  const structureRaw = o.structure as Record<string, unknown> | undefined;
  return {
    ...base,
    ...(o as Partial<ProductImageSetSettings>),
    structure: {
      whiteBg: Number(structureRaw?.whiteBg ?? base.structure.whiteBg) || 0,
      sellpoint: Number(structureRaw?.sellpoint ?? base.structure.sellpoint) || 0,
      scene: Number(structureRaw?.scene ?? base.structure.scene) || 0,
      other: Number(structureRaw?.other ?? base.structure.other) || 0,
    },
    selectedSellpointLayoutIds: Array.isArray(o.selectedSellpointLayoutIds)
      ? o.selectedSellpointLayoutIds.filter((x): x is string => typeof x === "string")
      : base.selectedSellpointLayoutIds,
    userLayoutRefs: Array.isArray(o.userLayoutRefs)
      ? (o.userLayoutRefs as ProductImageSetSettings["userLayoutRefs"])
      : base.userLayoutRefs,
    selectedTrendingStyleIds: Array.isArray(o.selectedTrendingStyleIds)
      ? o.selectedTrendingStyleIds.filter((x): x is string => typeof x === "string")
      : base.selectedTrendingStyleIds,
  };
}

export function parseOutput(raw: unknown): ProductImageSetOutput {
  if (!raw || typeof raw !== "object") return { slots: [] };
  const o = raw as ProductImageSetOutput;
  return {
    slots: Array.isArray(o.slots) ? o.slots : [],
    listingCopy: typeof o.listingCopy === "string" ? o.listingCopy : undefined,
  };
}

export function parseMeta(raw: unknown): ProductImageSetMeta {
  if (!raw || typeof raw !== "object") return {};
  return raw as ProductImageSetMeta;
}

export function sanitizeReferences(raw: unknown): ProductImageSetReference[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is ProductImageSetReference => Boolean(r && typeof r === "object"))
    .map((r, i) => ({
      id: String(r.id ?? `ref-${i}`),
      label: String(r.label ?? "产品图"),
      role: "product" as const,
      ossUrl: String(r.ossUrl ?? ""),
      sortIndex: Number(r.sortIndex ?? i),
    }))
    .filter((r) => r.ossUrl.trim())
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .slice(0, 6);
}
