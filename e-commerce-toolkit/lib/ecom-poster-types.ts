import type { EcomCopyImageArtifact } from "@private/ecom-copy-overlay";

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

export type PosterProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: PosterSettings;
  references: PosterReference[];
  plan: PosterPlan;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type PosterFestivalPack = {
  id: string;
  label: string;
  promptHint: string;
  copyTone: string;
  defaultTitle: string;
};
