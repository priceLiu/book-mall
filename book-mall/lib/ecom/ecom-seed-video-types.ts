import { z } from "zod";

export const ECOM_SEED_VIDEO_TOOL_KEY = "ecom-toolkit__seed-video";
export const ECOM_SEED_VIDEO_MODULE = "seed-video";
/** 策划助手须理解素材图，默认用支持图片理解的 LLM（非 qwen3.5-flash） */
export const ECOM_SEED_VIDEO_DEFAULT_CHAT_MODEL = "qwen3.8-max";
/** 方案②逐镜成片默认参考生视频（与 createTask · BAILIAN R2V 一致） */
export const ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL = "wan2.7-r2v";
/** 用户未在 Prompt 中说明时长时的默认目标成片秒数 */
export const ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC = 20;
/** 方案① 直接成片 · 单次生成模型上限（秒；wan2.6-r2v 等例外见 bailianR2vMaxDurationSec） */
export const ECOM_SEED_VIDEO_DIRECT_MAX_DURATION_SEC = 30;
/** 方案② · 多镜合成目标时长默认（秒；用户 Prompt 可覆盖） */
export const ECOM_SEED_VIDEO_FINE_DEFAULT_TARGET_DURATION_SEC = 20;

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
  /** 本条 user 消息引用的素材 ref id 列表（用于气泡上方缩略图） */
  refIds?: string[];
  choiceSnapshot?: SeedVideoChoiceSnapshot;
};

export type SeedVideoReference = {
  id: string;
  label: string;
  role: "seed-material";
  ossUrl: string;
};

export type SeedVideoScriptRow = {
  beatIndex: number;
  durationSec: number;
  refImageLabel: string;
  refImageId?: string;
  voiceover: string;
};

export type SeedVideoScript = {
  id: "script-1" | "script-2" | "script-3";
  title: string;
  angle: string;
  targetPlatforms: string[];
  totalDurationSec: number;
  rows: SeedVideoScriptRow[];
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

/** 方案① · 每次直接成片产出（追加，不覆盖历史） */
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
  /** 最新一条（兼容旧数据） */
  videoUrl?: string;
  taskId?: string;
  logId?: string;
  /** 历次直接成片（新 → 旧追加在末尾） */
  generatedVideos?: SeedVideoDirectGeneratedVideo[];
};

export type SeedVideoPlan = {
  materialAnalysis?: {
    productSummary: string;
    sellingPoints: string[];
    sceneTags: string[];
    styleTone: string;
  };
  scripts?: SeedVideoScript[];
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

import type { SeedVideoSkillKey } from "@/lib/ecom/ecom-seed-video-skills";

export type SeedVideoSettings = {
  chatModelKey?: string;
  videoModelKey?: string;
  ttsModelKey?: string;
  aspectRatio?: "9:16" | "16:9";
  targetDurationSec?: number;
  /** 创建时选定，不可切换 */
  skillKey?: SeedVideoSkillKey;
};

export type SeedVideoMeta = {
  workflow?: {
    phase?: SeedVideoWorkflowPhase;
    selectedScriptId?: SeedVideoScript["id"];
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
  /** 多镜并行 I2V；key 为镜号字符串 */
  pendingShotVideos?: Record<
    string,
    {
      modelKey?: string;
      startedAt: string;
    }
  >;
};

export const seedVideoShotSchema = z.object({
  index: z.number().int().positive(),
  timeSlice: z.string().min(1),
  refImageId: z.string().min(1),
  refImageLabel: z.string().min(1),
  sceneDescription: z.string().default(""),
  videoPrompt: z.string().min(1),
  voiceover: z.string().default(""),
  durationSec: z.number().positive(),
  videoUrl: z.string().optional(),
  ttsUrl: z.string().optional(),
  videoTaskId: z.string().optional(),
});

export const seedVideoPlanSchema = z.object({
  materialAnalysis: z
    .object({
      productSummary: z.string(),
      sellingPoints: z.array(z.string()),
      sceneTags: z.array(z.string()),
      styleTone: z.string(),
    })
    .optional(),
  scripts: z.array(z.any()).optional(),
  directVideo: z.any().optional(),
  stylePack: z.any().optional(),
  shots: z.array(seedVideoShotSchema).optional(),
  render: z
    .object({
      jobId: z.string().optional(),
      finalVideoUrl: z.string().optional(),
      assetId: z.string().optional(),
    })
    .optional(),
});

export function sanitizeSeedVideoReferences(raw: unknown): SeedVideoReference[] {
  if (!Array.isArray(raw)) return [];
  const out: SeedVideoReference[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const ossUrl = typeof r.ossUrl === "string" ? r.ossUrl.trim() : "";
    if (!ossUrl || !/^https?:\/\//.test(ossUrl)) continue;
    out.push({
      id: typeof r.id === "string" ? r.id : `ref-${out.length + 1}`,
      label: typeof r.label === "string" ? r.label.slice(0, 40) : `素材${out.length + 1}`,
      role: "seed-material",
      ossUrl,
    });
  }
  return out;
}

function sanitizeSeedVideoChoiceSnapshot(raw: unknown): SeedVideoChoiceSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  if (typeof s.title !== "string" || typeof s.subtitle !== "string") return undefined;
  if (typeof s.selectedMessage !== "string" || !s.selectedMessage.trim()) return undefined;
  if (!Array.isArray(s.choices) || s.choices.length === 0) return undefined;
  const choices: SeedVideoChoiceSnapshot["choices"] = [];
  for (const item of s.choices) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const message = typeof c.message === "string" ? c.message.trim() : "";
    const title = typeof c.title === "string" ? c.title.trim() : "";
    if (!message || !title) continue;
    choices.push({
      id: typeof c.id === "string" ? c.id : `choice-${choices.length + 1}`,
      label: typeof c.label === "string" ? c.label : title,
      message,
      title,
      description: typeof c.description === "string" ? c.description : undefined,
      recommended: c.recommended === true,
      kind:
        c.kind === "script" ||
        c.kind === "mode" ||
        c.kind === "style" ||
        c.kind === "generate-all" ||
        c.kind === "review" ||
        c.kind === "shots"
          ? c.kind
          : undefined,
    });
  }
  if (!choices.length) return undefined;
  return {
    title: s.title,
    subtitle: s.subtitle,
    choices,
    selectedMessage: s.selectedMessage.trim(),
  };
}

export function sanitizeSeedVideoChatMessages(raw: unknown): SeedVideoChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: SeedVideoChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = typeof m.content === "string" ? m.content : "";
    if (!content.trim()) continue;
    const choiceSnapshot = sanitizeSeedVideoChoiceSnapshot(m.choiceSnapshot);
    out.push({
      id: typeof m.id === "string" ? m.id : `${role}-${out.length}`,
      role,
      content,
      createdAt:
        typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
      refIds: Array.isArray(m.refIds)
        ? m.refIds.filter((x): x is string => typeof x === "string")
        : undefined,
      choiceSnapshot,
    });
  }
  return out;
}

export function parseSeedVideoPlan(raw: unknown): SeedVideoPlan | null {
  const parsed = seedVideoPlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data as SeedVideoPlan;
}

export const SEED_VIDEO_MATERIAL_MAX = 9;
