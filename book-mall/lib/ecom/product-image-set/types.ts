import { z } from "zod";

import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import {
  PRO_OUTPUT_LANGUAGES,
  PRO_PLATFORMS,
} from "@/lib/ecom/ecom-style-preset/platform-enums";

export const ECOM_PRODUCT_IMAGE_SET_MODULE = "product-image-set";
export const ECOM_PRODUCT_IMAGE_SET_TOOL_KEY = "ecom-toolkit__product-image-set";
export const ECOM_PRODUCT_IMAGE_SET_GENERATE_ACTION = "generate";
export const ECOM_PRODUCT_IMAGE_SET_BRIEF_ACTION = "brief";
export const ECOM_PRODUCT_IMAGE_SET_PLAN_ACTION = "plan-prompts";

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
  userLayoutRefId?: string;
  status?: "pending" | "generating" | "ready" | "failed";
  failMessage?: string;
  promptEdited?: boolean;
};

export type ProductImageSetOutput = {
  slots: ProductImageSetSlot[];
  listingCopy?: string;
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
  /** Gateway 生图尺寸 token（如 1:1_2K），与侧栏 imageRatio 配合 */
  imageGenSize?: string;
  imageGenConcurrency?: number;
};

export type ProductImageSetMeta = {
  sellpointDocument?: string;
  inferredVertical?: "fashion_apparel" | "bags" | "digital_3c" | "generic";
  phase?: "setup" | "planning" | "planned" | "generating" | "done";
  /** 最近一次「生成套图占位」是否由视觉 LLM 写满 Prompt */
  planPromptSource?: "llm" | "fallback";
  /** 最近一次占位若走规则兜底，记录 LLM 失败原因 */
  planPromptError?: string;
  /** 占位规划进行中（用于刷新后恢复 UI） */
  planStartedAt?: string;
  /** 槽位出图进行中 */
  genStartedAt?: string;
  /** 长任务超时自动解除 busy 时写入 */
  lastBusyStaleAt?: string;
};

export type ProductImageSetProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: ProductImageSetSettings;
  references: ProductImageSetReference[];
  output: ProductImageSetOutput;
  meta: ProductImageSetMeta;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_PRODUCT_IMAGE_SET_STRUCTURE: ProductImageSetStructureCounts = {
  whiteBg: 1,
  sellpoint: 3,
  scene: 6,
  other: 1,
};

export const DEFAULT_PRODUCT_IMAGE_SET_SETTINGS: ProductImageSetSettings = {
  platform: "amazon",
  market: "us",
  language: "英文",
  imageRatio: "1:1",
  structure: { ...DEFAULT_PRODUCT_IMAGE_SET_STRUCTURE },
  selectedSellpointLayoutIds: [],
  userLayoutRefs: [],
  trendingStyleEnabled: false,
  selectedTrendingStyleIds: [],
  listingCopyEnabled: true,
};

export const productImageSetStructureSchema = z.object({
  whiteBg: z.number().int().min(0).max(12),
  sellpoint: z.number().int().min(0).max(12),
  scene: z.number().int().min(0).max(20),
  other: z.number().int().min(0).max(12),
});

export function totalStructureCount(s: ProductImageSetStructureCounts): number {
  return s.whiteBg + s.sellpoint + s.scene + s.other;
}

export function productImageSetMarketOptions(): { value: string; label: string }[] {
  return [
    { value: "us", label: "美国" },
    { value: "uk", label: "英国" },
    { value: "de", label: "德国" },
    { value: "jp", label: "日本" },
  ];
}

export function productImageSetPlatformOptions(): { value: string; label: string }[] {
  return PRO_PLATFORMS.map((p) => ({
    value:
      p === "亚马逊"
        ? "amazon"
        : p === "TikTok Shop"
          ? "tiktok-shop"
          : p.toLowerCase().replace(/\s+/g, "-"),
    label: p,
  }));
}

export function productImageSetLanguageOptions(): { value: string; label: string }[] {
  return PRO_OUTPUT_LANGUAGES.map((l) => ({ value: l, label: l }));
}
