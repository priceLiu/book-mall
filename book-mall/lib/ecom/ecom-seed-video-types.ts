import { z } from "zod";

export const ECOM_SEED_VIDEO_TOOL_KEY = "ecom-toolkit__seed-video";
export const ECOM_SEED_VIDEO_MODULE = "seed-video";

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
  /** 本条 user 消息引用的素材 ref id 列表（用于气泡上方缩略图） */
  refIds?: string[];
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

export type SeedVideoDirectPlan = {
  globalPrompt: string;
  fullVoiceover: string;
  aspectRatio: string;
  durationSec: number;
  bgmPreset?: string;
  videoUrl?: string;
  taskId?: string;
  logId?: string;
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

export type SeedVideoSettings = {
  chatModelKey?: string;
  videoModelKey?: string;
  ttsModelKey?: string;
  aspectRatio?: "9:16" | "16:9";
  targetDurationSec?: number;
};

export type SeedVideoMeta = {
  workflow?: {
    phase?: SeedVideoWorkflowPhase;
    selectedScriptId?: SeedVideoScript["id"];
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

export function sanitizeSeedVideoChatMessages(raw: unknown): SeedVideoChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: SeedVideoChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = typeof m.content === "string" ? m.content : "";
    if (!content.trim()) continue;
    out.push({
      id: typeof m.id === "string" ? m.id : `${role}-${out.length}`,
      role,
      content,
      createdAt:
        typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
      refIds: Array.isArray(m.refIds)
        ? m.refIds.filter((x): x is string => typeof x === "string")
        : undefined,
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
