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

export const PLATFORM_OPTIONS = [
  { value: "amazon", label: "亚马逊" },
  { value: "taobao", label: "淘宝" },
  { value: "jd", label: "京东" },
  { value: "tiktok-shop", label: "TikTok Shop" },
  { value: "shopee", label: "Shopee" },
];

export const MARKET_OPTIONS = [
  { value: "us", label: "美国" },
  { value: "uk", label: "英国" },
  { value: "de", label: "德国" },
  { value: "jp", label: "日本" },
];

export const LANGUAGE_OPTIONS = [
  { value: "中文", label: "中文" },
  { value: "英文", label: "英文" },
  { value: "西班牙语", label: "西班牙语" },
  { value: "葡萄牙语", label: "葡萄牙语" },
];

export const RATIO_OPTIONS: { value: EcomImageRatio; label: string }[] = [
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "4:5", label: "4:5" },
];
