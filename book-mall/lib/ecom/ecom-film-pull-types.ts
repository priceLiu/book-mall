import { z } from "zod";

import { STORY_LLM_DEFAULT_VISION_MODEL } from "@/lib/canvas/story-llm-vision-models";

import type {
  FilmPullAnalyzePatch,
  FilmPullRenderScriptPatch,
} from "@/lib/ecom/ecom-film-pull-structured";

export const ECOM_FILM_PULL_TOOL_KEY = "ecom-toolkit__film-pull";
export const ECOM_FILM_PULL_MODULE = "film-pull";
export const ECOM_FILM_PULL_REPLICA_MODEL_PROMPT_ACTION = "replica-model-prompt";
export const ECOM_FILM_PULL_REPLICA_MODEL_GENERATE_ACTION = "replica-model-generate";
export const ECOM_FILM_PULL_REPLICA_RECOGNIZE_PRODUCT_ACTION = "replica-recognize-product";
export const ECOM_FILM_PULL_REPLICA_SCRIPT_ACTION = "replica-generate-script";
/** 须支持 video_url 理解（百炼 Qwen 系） */
export const ECOM_FILM_PULL_DEFAULT_CHAT_MODEL = STORY_LLM_DEFAULT_VISION_MODEL;
export const ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL = "wan2.7-r2v";

/** V1 单次拉片上限（>90s 须等分段模式；常见口播/广告片多在 60–90s） */
export const FILM_PULL_V1_MAX_SEC = 90;
export const FILM_PULL_SEGMENT_ENABLED = false;
export const FILM_PULL_MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export type FilmPullMediaSource = "upload" | "url" | "asset";

export type FilmPullMediaReference = {
  id: string;
  ossUrl: string;
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  source: FilmPullMediaSource;
  sourceUrl?: string;
  label?: string;
};

export type FilmPullCharacterRef = {
  id: string;
  ossUrl: string;
  label?: string;
};

export type FilmPullSettings = {
  chatModelKey?: string;
  videoModelKey?: string;
  lastAnalyzePrompt?: string;
  aspectRatio?: "16:9" | "9:16";
};

export type FilmPullStructuredResult<T> = {
  rawText?: string;
  structured?: T | null;
  parseError?: string | null;
  completedAt?: string;
};

export type FilmPullRenderShot = {
  shotNo: number;
  videoPrompt: string;
  durationSec: number;
  videoUrl?: string;
  videoTaskId?: string;
  voiceover?: string;
};

import type { FilmPullShot } from "@/lib/ecom/ecom-film-pull-structured";

export type FilmPullProductionShotStatus =
  | "pending_script"
  | "pending_image"
  | "pending_video"
  | "ready";

export type FilmPullRefMatchShot = {
  shotNo: number;
  modelRefIds: string[];
  productRefIds: string[];
};

export type FilmPullRefMatch = {
  shots: FilmPullRefMatchShot[];
};

export type FilmPullProductionGlobalConfig = {
  characterUnifiedStyle?: string;
  globalLighting?: string;
  resolution?: string;
  fps?: string;
  globalVisualTone?: string;
};

export type FilmPullProductInteraction =
  | "none"
  | "hold"
  | "wear"
  | "use"
  | "apply"
  | "display"
  | "unbox";

const PRODUCT_INTERACTIONS = new Set<FilmPullProductInteraction>([
  "none",
  "hold",
  "wear",
  "use",
  "apply",
  "display",
  "unbox",
]);

/** 制作脚本镜：拉片全维度 + 故事版式确认字段 + 参考图 + 出片结果 */
export type FilmPullProductionShot = FilmPullShot & {
  modelRefIds: string[];
  productRefIds: string[];
  imagePrompt: string;
  videoPrompt: string;
  productInteraction?: FilmPullProductInteraction;
  sellpointNote?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  videoTaskId?: string;
  ttsUrl?: string | null;
  status: FilmPullProductionShotStatus;
};

export type FilmPullProductionPlan = {
  globalConfig?: FilmPullProductionGlobalConfig;
  shots: FilmPullProductionShot[];
  render?: {
    jobId?: string;
    finalVideoUrl?: string;
  };
};

export type FilmPullRenderPlan = {
  shots: FilmPullRenderShot[];
  render?: {
    jobId?: string;
    finalVideoUrl?: string;
  };
};

export type FilmPullChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type FilmPullMeta = {
  analyzeMode?: "single" | "segmented";
  segments?: unknown[];
  finalVideoUrl?: string;
  mediaRenderJobId?: string;
  sourceApp?: "ecom" | "canvas";
  canvasProjectId?: string;
  analyzeStartedAt?: string;
  /** 当前拉片任务 ID，用于中止 */
  analyzeRunId?: string;
  analyzeCancelRunId?: string | null;
  /** 识产品 / 手动填写的产品描述 */
  productBrief?: string;
  /** 参考图匹配已确认 */
  refMatchConfirmedAt?: string | null;
  /** 制作脚本已确认 */
  productionScriptConfirmedAt?: string | null;
  /** @deprecated V2 不再使用 seed-video */
  replicaSeedVideoProjectId?: string | null;
  /** 复刻绑定的拉片结果完成时间 */
  replicaResultAt?: string | null;
  /** 复刻流程产品描述（与 productBrief 同步） */
  replicaProductBrief?: string | null;
};

export type FilmPullProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: FilmPullSettings;
  media: FilmPullMediaReference | null;
  analyzeResult: FilmPullStructuredResult<FilmPullAnalyzePatch> | null;
  renderScript: FilmPullStructuredResult<FilmPullRenderScriptPatch> | null;
  characterRefs: FilmPullCharacterRef[];
  renderPlan: FilmPullRenderPlan | null;
  refMatch: FilmPullRefMatch | null;
  productionPlan: FilmPullProductionPlan | null;
  chatHistory: FilmPullChatMessage[];
  meta: FilmPullMeta | null;
  createdAt: string;
  updatedAt: string;
};

const mediaRefSchema = z.object({
  id: z.string().min(1),
  ossUrl: z.string().url(),
  durationSec: z.number().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().positive().optional(),
  source: z.enum(["upload", "url", "asset"]),
  sourceUrl: z.string().optional(),
  label: z.string().optional(),
});

const characterRefSchema = z.object({
  id: z.string().min(1),
  ossUrl: z.string().url(),
  label: z.string().optional(),
});

export function sanitizeFilmPullMedia(raw: unknown): FilmPullMediaReference | null {
  const parsed = mediaRefSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function sanitizeFilmPullCharacterRefs(raw: unknown): FilmPullCharacterRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => characterRefSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data!);
}

export function sanitizeFilmPullSettings(raw: unknown): FilmPullSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    chatModelKey:
      typeof o.chatModelKey === "string" && o.chatModelKey.trim()
        ? o.chatModelKey.trim()
        : undefined,
    videoModelKey:
      typeof o.videoModelKey === "string" && o.videoModelKey.trim()
        ? o.videoModelKey.trim()
        : undefined,
    lastAnalyzePrompt:
      typeof o.lastAnalyzePrompt === "string" && o.lastAnalyzePrompt.trim()
        ? o.lastAnalyzePrompt.trim()
        : undefined,
    aspectRatio:
      o.aspectRatio === "16:9" || o.aspectRatio === "9:16" ? o.aspectRatio : undefined,
  };
}

export function sanitizeFilmPullAnalyzeResult(
  raw: unknown,
): FilmPullStructuredResult<FilmPullAnalyzePatch> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    rawText: typeof o.rawText === "string" ? o.rawText : undefined,
    structured:
      o.structured && typeof o.structured === "object"
        ? (o.structured as FilmPullAnalyzePatch)
        : o.structured === null
          ? null
          : undefined,
    parseError: typeof o.parseError === "string" ? o.parseError : o.parseError === null ? null : undefined,
    completedAt: typeof o.completedAt === "string" ? o.completedAt : undefined,
  };
}

export function sanitizeFilmPullRenderScriptResult(
  raw: unknown,
): FilmPullStructuredResult<FilmPullRenderScriptPatch> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    rawText: typeof o.rawText === "string" ? o.rawText : undefined,
    structured:
      o.structured && typeof o.structured === "object"
        ? (o.structured as FilmPullRenderScriptPatch)
        : o.structured === null
          ? null
          : undefined,
    parseError: typeof o.parseError === "string" ? o.parseError : o.parseError === null ? null : undefined,
    completedAt: typeof o.completedAt === "string" ? o.completedAt : undefined,
  };
}

export function sanitizeFilmPullRenderPlan(raw: unknown): FilmPullRenderPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const shots = Array.isArray(o.shots) ? o.shots : [];
  return {
    shots: shots
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const row = s as Record<string, unknown>;
        const shotNo = Number(row.shotNo);
        const durationSec = Number(row.durationSec);
        if (!Number.isFinite(shotNo) || shotNo < 1) return null;
        return {
          shotNo: Math.trunc(shotNo),
          videoPrompt: typeof row.videoPrompt === "string" ? row.videoPrompt : "",
          durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 5,
          videoUrl: typeof row.videoUrl === "string" ? row.videoUrl : undefined,
          videoTaskId: typeof row.videoTaskId === "string" ? row.videoTaskId : undefined,
          voiceover: typeof row.voiceover === "string" ? row.voiceover : undefined,
        } as FilmPullRenderShot;
      })
      .filter((s): s is FilmPullRenderShot => s !== null),
    render:
      o.render && typeof o.render === "object"
        ? (o.render as FilmPullRenderPlan["render"])
        : undefined,
  };
}

function sanitizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export function sanitizeFilmPullRefMatch(raw: unknown): FilmPullRefMatch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const shots = Array.isArray(o.shots) ? o.shots : [];
  const parsed = shots
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const row = s as Record<string, unknown>;
      const shotNo = Number(row.shotNo);
      if (!Number.isFinite(shotNo) || shotNo < 1) return null;
      return {
        shotNo: Math.trunc(shotNo),
        modelRefIds: sanitizeStringArray(row.modelRefIds),
        productRefIds: sanitizeStringArray(row.productRefIds),
      } satisfies FilmPullRefMatchShot;
    })
    .filter((s): s is FilmPullRefMatchShot => s !== null);
  return parsed.length > 0 ? { shots: parsed } : null;
}

const PRODUCTION_STATUSES = new Set<FilmPullProductionShotStatus>([
  "pending_script",
  "pending_image",
  "pending_video",
  "ready",
]);

function productionStringField(row: Record<string, unknown>, key: string, fallback = "无"): string {
  const v = row[key];
  return typeof v === "string" && v.trim() ? v : fallback;
}

function parseProductionAudioInfo(row: Record<string, unknown>) {
  const nested = row.audioInfo;
  if (nested && typeof nested === "object") {
    const a = nested as Record<string, unknown>;
    return {
      scriptSubtitle: productionStringField(a, "scriptSubtitle", productionStringField(row, "voiceover")),
      vocalEmotion: productionStringField(a, "vocalEmotion", productionStringField(row, "vocalEmotion")),
      ambientSound: productionStringField(a, "ambientSound"),
      fxAndBgm: productionStringField(a, "fxAndBgm"),
    };
  }
  return {
    scriptSubtitle: productionStringField(row, "voiceover"),
    vocalEmotion: productionStringField(row, "vocalEmotion"),
    ambientSound: "无",
    fxAndBgm: "无",
  };
}

export function sanitizeFilmPullProductionPlan(raw: unknown): FilmPullProductionPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const shots = Array.isArray(o.shots) ? o.shots : [];
  const parsed = shots
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const row = s as Record<string, unknown>;
      const shotNo = Number(row.shotNo);
      const durationSec = Number(row.durationSec);
      if (!Number.isFinite(shotNo) || shotNo < 1) return null;
      const statusRaw = row.status;
      const status =
        typeof statusRaw === "string" && PRODUCTION_STATUSES.has(statusRaw as FilmPullProductionShotStatus)
          ? (statusRaw as FilmPullProductionShotStatus)
          : "pending_video";
      const legacyCanvas = typeof row.canvasDescription === "string" ? row.canvasDescription : "";
      const legacyMotion = typeof row.cameraMotion === "string" ? row.cameraMotion : "";
      const legacyLighting = typeof row.lightingStructure === "string" ? row.lightingStructure : "";
      return {
        shotNo: Math.trunc(shotNo),
        startTimeSec: Number(row.startTimeSec) || 0,
        endTimeSec: Number(row.endTimeSec) || 0,
        durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 5,
        cutTransition: productionStringField(row, "cutTransition", "硬切"),
        shotScale: productionStringField(row, "shotScale", legacyMotion.split("·")[0]?.trim() || "中景"),
        cameraAngle: productionStringField(row, "cameraAngle"),
        cameraMovement: productionStringField(row, "cameraMovement", legacyMotion.split("·")[2]?.trim() || "固定机位"),
        focalLengthPerspective: productionStringField(row, "focalLengthPerspective"),
        composition: productionStringField(row, "composition"),
        subjectBlocking: productionStringField(row, "subjectBlocking"),
        sightDirection: productionStringField(row, "sightDirection"),
        sceneEnvironment: productionStringField(row, "sceneEnvironment", legacyCanvas || "无"),
        foreMidBackLayer: productionStringField(row, "foreMidBackLayer"),
        dynamicProps: productionStringField(row, "dynamicProps"),
        lightingSetup: productionStringField(row, "lightingSetup", legacyLighting.split("·")[0]?.trim() || "无"),
        toneContrast: productionStringField(row, "toneContrast", legacyLighting.split("·")[1]?.trim() || "无"),
        narrativeFunction: productionStringField(row, "narrativeFunction"),
        audioInfo: parseProductionAudioInfo(row),
        rhythmWeight: productionStringField(row, "rhythmWeight"),
        visualMetaphor: productionStringField(row, "visualMetaphor"),
        aiVisualPrompt: productionStringField(row, "aiVisualPrompt"),
        productInteraction: PRODUCT_INTERACTIONS.has(row.productInteraction as FilmPullProductInteraction)
          ? (row.productInteraction as FilmPullProductInteraction)
          : "none",
        sellpointNote:
          typeof row.sellpointNote === "string" && row.sellpointNote.trim()
            ? row.sellpointNote.trim()
            : "",
        modelRefIds: sanitizeStringArray(row.modelRefIds),
        productRefIds: sanitizeStringArray(row.productRefIds),
        imagePrompt: typeof row.imagePrompt === "string" ? row.imagePrompt : "",
        videoPrompt: typeof row.videoPrompt === "string" ? row.videoPrompt : "",
        imageUrl:
          typeof row.imageUrl === "string"
            ? row.imageUrl
            : row.imageUrl === null
              ? null
              : undefined,
        videoUrl:
          typeof row.videoUrl === "string"
            ? row.videoUrl
            : row.videoUrl === null
              ? null
              : undefined,
        videoTaskId: typeof row.videoTaskId === "string" ? row.videoTaskId : undefined,
        ttsUrl:
          typeof row.ttsUrl === "string"
            ? row.ttsUrl
            : row.ttsUrl === null
              ? null
              : undefined,
        status,
      } as FilmPullProductionShot;
    })
    .filter((s): s is FilmPullProductionShot => s !== null);
  if (parsed.length === 0) return null;
  return {
    globalConfig:
      o.globalConfig && typeof o.globalConfig === "object"
        ? (o.globalConfig as FilmPullProductionGlobalConfig)
        : undefined,
    shots: parsed,
    render:
      o.render && typeof o.render === "object"
        ? (o.render as FilmPullProductionPlan["render"])
        : undefined,
  };
}

export function sanitizeFilmPullChatHistory(raw: unknown): FilmPullChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is FilmPullChatMessage =>
      Boolean(m) &&
      typeof m === "object" &&
      typeof (m as FilmPullChatMessage).content === "string" &&
      ((m as FilmPullChatMessage).role === "user" ||
        (m as FilmPullChatMessage).role === "assistant"),
  );
}

export function isEcomFilmPullAnalyzeActive(
  project: Pick<FilmPullProjectDto, "status" | "analyzeResult" | "meta"> | null,
): boolean {
  if (!project || project.status !== "analyzing") return false;
  if (project.analyzeResult?.completedAt) return false;
  const meta = project.meta;
  if (
    meta?.analyzeCancelRunId &&
    meta.analyzeRunId &&
    meta.analyzeCancelRunId === meta.analyzeRunId
  ) {
    return false;
  }
  return true;
}

export type { FilmPullAnalyzePatch, FilmPullRenderScriptPatch };
