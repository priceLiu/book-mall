import type { EcomCopyImageArtifact } from "@private/ecom-copy-overlay";
import { parseEcomCopyImageArtifact } from "@private/ecom-copy-overlay";

export const ECOM_POSTER_MODULE = "poster" as const;
export const ECOM_POSTER_TOOL_KEY = "ecom-toolkit__poster" as const;

export type PosterEasyPath = "A" | "B" | "C" | "D";
export type PosterProMode = "text" | "image-ref" | "template";
export type PosterTier = "easy" | "pro";

export type PosterRefRole = "model" | "garment" | "scene" | "brand" | "product" | "style";

export type PosterReference = {
  id: string;
  role: PosterRefRole;
  label?: string;
  ossUrl: string;
  assetId?: string;
};

export type PosterAutoPlan = {
  summary: string;
  slotCopy: string;
  slotCopyAi?: string;
  imagePrompt: string;
  festivalId?: string;
  easyPath?: PosterEasyPath;
};

export type PosterPlan = {
  tier: PosterTier;
  easyPath?: PosterEasyPath;
  proMode?: PosterProMode;
  festivalId?: string;
  useBrandRefs: boolean;
  burnCopyInImage: boolean;
  aspectRatio: string;
  posterStyleId: string;
  modelKey?: string;
  templateCatalogId?: string;
  autoPlan?: PosterAutoPlan;
  artifacts: EcomCopyImageArtifact[];
  activeArtifactIndex?: number;
};

export type PosterSettings = {
  imageModelKey?: string;
  imageCount?: number;
};

export type PosterMeta = {
  workflow?: { lastTab?: "easy" | "pro" };
};

export function defaultPosterPlan(): PosterPlan {
  return {
    tier: "easy",
    easyPath: "C",
    useBrandRefs: false,
    burnCopyInImage: false,
    aspectRatio: "1:1",
    posterStyleId: "promo-sale",
    artifacts: [],
  };
}

export function parsePosterPlan(raw: unknown): PosterPlan {
  const base = defaultPosterPlan();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const artifactsRaw = Array.isArray(o.artifacts) ? o.artifacts : [];
  const artifacts = artifactsRaw.flatMap((item) => {
    const parsed = parseEcomCopyImageArtifact(item);
    return parsed ? [parsed] : [];
  });
  return {
    ...base,
    tier: o.tier === "pro" ? "pro" : "easy",
    easyPath:
      o.easyPath === "A" || o.easyPath === "B" || o.easyPath === "C" || o.easyPath === "D"
        ? o.easyPath
        : base.easyPath,
    proMode:
      o.proMode === "text" || o.proMode === "image-ref" || o.proMode === "template"
        ? o.proMode
        : base.proMode,
    festivalId: typeof o.festivalId === "string" ? o.festivalId : undefined,
    useBrandRefs: o.useBrandRefs === true,
    burnCopyInImage: o.burnCopyInImage === true,
    aspectRatio: typeof o.aspectRatio === "string" ? o.aspectRatio : base.aspectRatio,
    posterStyleId: typeof o.posterStyleId === "string" ? o.posterStyleId : base.posterStyleId,
    modelKey: typeof o.modelKey === "string" ? o.modelKey : undefined,
    templateCatalogId:
      typeof o.templateCatalogId === "string" ? o.templateCatalogId : undefined,
    autoPlan:
      o.autoPlan && typeof o.autoPlan === "object"
        ? (o.autoPlan as PosterAutoPlan)
        : undefined,
    artifacts,
    activeArtifactIndex:
      typeof o.activeArtifactIndex === "number" ? o.activeArtifactIndex : undefined,
  };
}

export function sanitizePosterReferences(raw: unknown): PosterReference[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): PosterReference[] => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const ossUrl = typeof r.ossUrl === "string" ? r.ossUrl.trim() : "";
    if (!ossUrl) return [];
    const role = r.role as PosterRefRole;
    const validRole =
      role === "model" ||
      role === "garment" ||
      role === "scene" ||
      role === "brand" ||
      role === "product" ||
      role === "style"
        ? role
        : "product";
    return [
      {
        id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : ossUrl,
        role: validRole,
        ossUrl,
        ...(typeof r.label === "string" ? { label: r.label } : {}),
        ...(typeof r.assetId === "string" ? { assetId: r.assetId } : {}),
      },
    ];
  });
}

export function parsePosterSettings(raw: unknown): PosterSettings {
  if (!raw || typeof raw !== "object") return {};
  const s = raw as Record<string, unknown>;
  return {
    ...(typeof s.imageModelKey === "string" ? { imageModelKey: s.imageModelKey } : {}),
    ...(typeof s.imageCount === "number" ? { imageCount: s.imageCount } : {}),
  };
}

export function parsePosterMeta(raw: unknown): PosterMeta | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as PosterMeta;
}

export function exportWidthForAspect(aspect: string): number {
  if (aspect === "9:16") return 750;
  if (aspect === "3:4") return 750;
  if (aspect === "16:9") return 750;
  return 750;
}
