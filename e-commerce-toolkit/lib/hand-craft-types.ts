import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

export const HAND_CRAFT_STEP_IDS = [
  "hero",
  "spec-kit",
  "blindbox",
  "merch",
  "brand-spec",
  "packaging",
  "emoji",
  "xhs-long",
  "portfolio",
  "licensing",
] as const;

export type HandCraftStepId = (typeof HAND_CRAFT_STEP_IDS)[number];

export type HandCraftStepKind = "generate" | "compose";

export type HandCraftChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  refIds?: string[];
};

export type HandCraftReference = {
  id: string;
  label: string;
  role: "sketch";
  ossUrl: string;
};

export type HandCraftSlot = {
  index: number;
  title: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
  promptEdited?: boolean;
};

export type HandCraftComposeOutput = {
  index: number;
  title: string;
  imageUrl: string;
  assetId?: string;
};

export type HandCraftStepState = {
  stepId: HandCraftStepId;
  status: "pending" | "generating" | "ready";
  slots: HandCraftSlot[];
  outputs: HandCraftComposeOutput[];
  updatedAt?: string;
};

export type HandCraftPlan = {
  steps: Partial<Record<HandCraftStepId, HandCraftStepState>>;
};

export type HandCraftSettings = {
  chatModelKey?: string;
  imageModelKey?: string;
  imageGenConcurrency?: number;
};

export type HandCraftProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: HandCraftSettings;
  references: HandCraftReference[];
  chatHistory: HandCraftChatMessage[];
  plan: HandCraftPlan;
  meta: {
    workflow?: {
      currentStepId?: HandCraftStepId;
      /** 第 1 步定稿的基准主形象：后续每步都会作为参考图传入 */
      heroLockedUrl?: string;
    };
    lastAssistantRaw?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type HandCraftModelsPayload = {
  chatModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  platformOffering: boolean;
  imageGenConcurrencyLimit: number;
  defaults: { chat: string; image: string };
};

export const HAND_CRAFT_SKETCH_MAX = 3;

export const HAND_CRAFT_SKETCH_GEN_MODEL = "wan2.7-image";

export const HAND_CRAFT_SKETCH_GEN_DEFAULT_PROMPT =
  "手绘铅笔画卷发女孩 基于这个IP草图，保持所有细节不变，生成泡泡玛特风格，3D卡通角色，高清可爱，明亮干净的色调，柔和光影过渡塑造简洁现代的视觉氛围，手办，纯白色背景";
