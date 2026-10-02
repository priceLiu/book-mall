import type { EcomImageRatio } from "@/lib/product-design-types";

export const PRODUCT_IMAGE_SET_MAX_PRODUCT_REFS = 6;

export type ProductImageSetReference = {
  id: string;
  label: string;
  role: "product";
  ossUrl: string;
  sortIndex: number;
};

export type ProductImageSetUserLayoutRef = {
  id: string;
  ossUrl: string;
  label?: string;
};

export type ProductImageSetSlotKind = "white_bg" | "sellpoint" | "scene" | "other";

export type ProductImageSetSlot = {
  id: string;
  kind: ProductImageSetSlotKind;
  index: number;
  title: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
  layoutPresetId?: string;
  status?: "pending" | "generating" | "ready" | "failed";
  failMessage?: string;
  promptEdited?: boolean;
};

export type ProductImageSetStructureCounts = {
  whiteBg: number;
  sellpoint: number;
  scene: number;
  other: number;
};

export type ProductImageSetSettings = {
  platform?: string;
  market?: string;
  language?: string;
  imageRatio?: EcomImageRatio;
  structure: ProductImageSetStructureCounts;
  selectedSellpointLayoutIds: string[];
  userLayoutRefs: ProductImageSetUserLayoutRef[];
  trendingStyleEnabled: boolean;
  selectedTrendingStyleIds: string[];
  trendingStyleSeed?: string;
  listingCopyEnabled: boolean;
  visionModelKey?: string;
  imageModelKey?: string;
  imageGenSize?: string;
};

export type ProductImageSetMeta = {
  sellpointDocument?: string;
  inferredVertical?: "fashion_apparel" | "bags" | "digital_3c" | "generic";
  phase?: "setup" | "planning" | "planned" | "generating" | "done";
  planPromptSource?: "llm" | "fallback";
  planPromptError?: string;
  planStartedAt?: string;
  genStartedAt?: string;
  lastBusyStaleAt?: string;
};

export type ProductImageSetProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: ProductImageSetSettings;
  references: ProductImageSetReference[];
  output: { slots: ProductImageSetSlot[]; listingCopy?: string };
  meta: ProductImageSetMeta;
  createdAt: string;
  updatedAt: string;
};

export type ProductImageSetSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  thumbnailUrl: string | null;
};

export function totalStructureCount(s: ProductImageSetStructureCounts): number {
  return s.whiteBg + s.sellpoint + s.scene + s.other;
}

export {
  ECOM_COUNTRY_OPTIONS as MARKET_OPTIONS,
  ECOM_LANGUAGE_OPTIONS as LANGUAGE_OPTIONS,
  ECOM_PLATFORM_OPTIONS as PLATFORM_OPTIONS,
} from "@/lib/ecom-generation-settings/constants";

export const RATIO_OPTIONS: { value: EcomImageRatio; label: string }[] = [
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "4:5", label: "4:5" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];
