import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import type { SeedVideoSkillKey } from "@/lib/seed-video-skills";

/** 用户未在 Prompt 中说明时长时的默认目标成片秒数 */
export const SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC = 20;
/** 与 book-mall 一致 · 方案① direct 单次生成模型上限 */
export const SEED_VIDEO_DIRECT_MAX_DURATION_SEC = 30;

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

/** 用户点选后冻结在会话流中的选项卡片（选中态保留，不消失） */
export type SeedVideoChoiceSnapshot = {
  title: string;
  subtitle: string;
  choices: Array<{
    id: string;
    label: string;
    message: string;
    title: string;
    description?: string;
    recommended?: boolean;
    kind?: string;
  }>;
  selectedMessage: string;
};

export type SeedVideoChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  refIds?: string[];
  choiceSnapshot?: SeedVideoChoiceSnapshot;
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
  videoTaskId?: string;
};

export type SeedVideoDirectShotPreview = {
  index: number;
  timeSlice: string;
  refImageLabel: string;
  sceneDescription: string;
  voiceover: string;
  durationSec: number;
};

export type SeedVideoDirectGeneratedVideo = {
  id: string;
  videoUrl: string;
  taskId?: string;
  modelKey?: string;
  createdAt?: string;
};

export type SeedVideoDirectPlan = {
  globalPrompt: string;
  fullVoiceover: string;
  aspectRatio: string;
  durationSec: number;
  bgmPreset?: string;
  voiceTone?: string;
  materialUsage?: string;
  shotSequence?: SeedVideoDirectShotPreview[];
  videoUrl?: string;
  taskId?: string;
  generatedVideos?: SeedVideoDirectGeneratedVideo[];
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
  skillKey?: SeedVideoSkillKey;
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
    planningPrompt?: string;
    storyboardDraft?: Array<Record<string, unknown>>;
    workflow?: {
      phase?: SeedVideoWorkflowPhase;
      selectedScriptId?: string;
      productionMode?: SeedVideoProductionMode;
      stylePreset?: SeedVideoStylePreset;
      editingStoryboard?: boolean;
      planSynced?: boolean;
    };
    lastAssistantRaw?: string;
    pendingDirectVideo?: {
      taskId: string;
      logId: string;
      modelKey: string;
      startedAt: string;
    };
    pendingShotVideo?: {
      shotIndex: number;
      modelKey?: string;
      startedAt: string;
    };
    pendingShotVideos?: Record<
      string,
      {
        modelKey?: string;
        startedAt: string;
      }
    >;
    /** 拆图拆视频 · 一键复刻采集 */
    replicaCollectPhase?: string;
    replicaProductBrief?: string | null;
    replicaModelPrompt?: string;
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
