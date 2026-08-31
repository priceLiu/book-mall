import { z } from "zod";

import { ECOM_DEFAULT_ASSISTANT_CHAT_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import type {
  FilmPullAnalyzePatch,
  FilmPullRenderScriptPatch,
} from "@/lib/ecom/ecom-film-pull-structured";

export const ECOM_FILM_PULL_TOOL_KEY = "ecom-toolkit__film-pull";
export const ECOM_FILM_PULL_MODULE = "film-pull";
export const ECOM_FILM_PULL_DEFAULT_CHAT_MODEL = ECOM_DEFAULT_ASSISTANT_CHAT_MODEL;
export const ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL = "wan2.7-r2v";

export const FILM_PULL_V1_MAX_SEC = 60;
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
        } satisfies FilmPullRenderShot;
      })
      .filter((s): s is FilmPullRenderShot => s !== null),
    render:
      o.render && typeof o.render === "object"
        ? (o.render as FilmPullRenderPlan["render"])
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

export type { FilmPullAnalyzePatch, FilmPullRenderScriptPatch };
