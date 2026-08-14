import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

export type SeedVideoWorkflowPhase =
  | "material"
  | "scripts"
  | "mode"
  | "style"
  | "shots"
  | "production"
  | "done";

export type SeedVideoProductionMode = "direct" | "fine";

export type SeedVideoStylePreset = "sweet-xhs" | "sharp-douyin";

export type SeedVideoChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  refIds?: string[];
};

export type SeedVideoReference = {
  id: string;
  label: string;
  role: "seed-material";
  ossUrl: string;
};

export type SeedVideoShot = {
  index: number;
  timeSlice: string;
  refImageId: string;
  refImageLabel: string;
  sceneDescription: string;
  videoPrompt: string;
  voiceover: string;
  durationSec: number;
  videoUrl?: string;
  ttsUrl?: string;
};

export type SeedVideoDirectPlan = {
  globalPrompt: string;
  fullVoiceover: string;
  aspectRatio: string;
  durationSec: number;
  bgmPreset?: string;
  videoUrl?: string;
  taskId?: string;
};

export type SeedVideoPlan = {
  scripts?: unknown[];
  directVideo?: SeedVideoDirectPlan;
  stylePack?: {
    voiceLabel: string;
    voicePreset: string;
    bgmPreset: string;
    copyTone: string;
  };
  shots?: SeedVideoShot[];
  render?: {
    jobId?: string;
    finalVideoUrl?: string;
    assetId?: string;
  };
};

export type SeedVideoSettings = {
  chatModelKey?: string;
  videoModelKey?: string;
  ttsModelKey?: string;
  aspectRatio?: "9:16" | "16:9";
  targetDurationSec?: number;
};

export type SeedVideoProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: SeedVideoSettings;
  references: SeedVideoReference[];
  chatHistory: SeedVideoChatMessage[];
  plan: SeedVideoPlan | null;
  videoAssetId: string | null;
  videoOssUrl: string | null;
  meta: {
    workflow?: {
      phase?: SeedVideoWorkflowPhase;
      selectedScriptId?: string;
      productionMode?: SeedVideoProductionMode;
      stylePreset?: SeedVideoStylePreset;
    };
    lastAssistantRaw?: string;
    pendingDirectVideo?: {
      taskId: string;
      logId: string;
      modelKey: string;
      startedAt: string;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type SeedVideoModelsPayload = {
  chatModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
};

export const SEED_VIDEO_STEPS = [
  { id: "material", label: "素材", short: "材" },
  { id: "scripts", label: "脚本", short: "脚" },
  { id: "mode", label: "模式", short: "模" },
  { id: "style", label: "风格", short: "风" },
  { id: "shots", label: "成片", short: "片" },
] as const;

export type SeedVideoStepId = (typeof SEED_VIDEO_STEPS)[number]["id"];
