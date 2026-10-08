import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

export const BRAND_VI_STEP_IDS = [
  "hero",
  "turnaround",
  "emoji",
  "logo",
  "merch",
  "poster",
  "vi-spec",
  "portfolio",
] as const;

export const BRAND_VI_PROJECT_MODES = [
  "basic-ip",
  "emoji-only",
  "vi-only",
  "merch-only",
  "full",
] as const;

export type BrandViProjectMode = (typeof BRAND_VI_PROJECT_MODES)[number];

export type BrandViStepId = (typeof BRAND_VI_STEP_IDS)[number];

export type BrandViStepKind = "generate" | "compose";

export type BrandViChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  refIds?: string[];
};

export type BrandViReference = {
  id: string;
  label: string;
  role: "reference" | "sketch";
  ossUrl: string;
};

export type BrandViSlot = {
  index: number;
  title: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
  promptEdited?: boolean;
};

export type BrandViComposeOutput = {
  index: number;
  title: string;
  imageUrl: string;
  assetId?: string;
};

export type BrandViStepState = {
  stepId: BrandViStepId;
  status: "pending" | "generating" | "ready";
  slots: BrandViSlot[];
  outputs: BrandViComposeOutput[];
  updatedAt?: string;
};

export type BrandViPlan = {
  steps: Partial<Record<BrandViStepId, BrandViStepState>>;
};

export type BrandViSettings = {
  chatModelKey?: string;
  imageModelKey?: string;
  imageGenConcurrency?: number;
  stylePresetId?: string;
  styleCustomText?: string;
  projectMode?: BrandViProjectMode;
  ipMasterProjectId?: string;
  ipMasterVersion?: string;
  referenceFromIpMaster?: boolean;
};

export type BrandViProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: BrandViSettings;
  references: BrandViReference[];
  chatHistory: BrandViChatMessage[];
  plan: BrandViPlan;
  meta: {
    workflow?: {
      currentStepId?: BrandViStepId;
      /** 第 1 步定稿的基准主形象：后续每步都会作为参考图传入 */
      heroLockedUrl?: string;
    };
    lastAssistantRaw?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type BrandViModelsPayload = {
  chatModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  platformOffering: boolean;
  imageGenConcurrencyLimit: number;
  defaults: { chat: string; image: string };
};

export const BRAND_VI_SKETCH_MAX = 3;

export const BRAND_VI_SKETCH_GEN_MODEL = "wan2.7-image";

export const BRAND_VI_SKETCH_GEN_DEFAULT_PROMPT =
  "手绘铅笔画卷发女孩 基于这个IP草图，保持所有细节不变，生成泡泡玛特风格，3D卡通角色，高清可爱，明亮干净的色调，柔和光影过渡塑造简洁现代的视觉氛围，手办，纯白色背景";
