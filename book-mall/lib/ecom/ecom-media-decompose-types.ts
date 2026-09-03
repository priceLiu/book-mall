import { z } from "zod";

import {
  ECOM_DEFAULT_ASSISTANT_CHAT_MODEL,
  ECOM_DEFAULT_VISION_MODEL,
} from "@/lib/gateway/ecom-storyboard-chat-models";

import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import {
  extractMediaDecomposePatch,
  normalizeMediaDecomposePatch,
} from "@/lib/ecom/ecom-media-decompose-structured";

export const ECOM_MEDIA_DECOMPOSE_TOOL_KEY = "ecom-toolkit__media-decompose";
export const ECOM_MEDIA_DECOMPOSE_MODULE = "media-decompose";
/** 拆解（图片/视频反推）：须 Vision / 视频理解模型，默认 Qwen3.8 Max */
export const ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL = ECOM_DEFAULT_VISION_MODEL;

/** 复刻口播/卖点等纯文本任务默认 LLM（非拆解用） */
export const ECOM_MEDIA_DECOMPOSE_DEFAULT_TEXT_MODEL = ECOM_DEFAULT_ASSISTANT_CHAT_MODEL;

/** Gateway clientPage action 后缀（写 GatewayRequestLog） */
export const ECOM_MEDIA_DECOMPOSE_REPLICA_MODEL_PROMPT_ACTION = "replica-model-prompt";
export const ECOM_MEDIA_DECOMPOSE_REPLICA_MODEL_GENERATE_ACTION = "replica-model-generate";
export const ECOM_MEDIA_DECOMPOSE_REPLICA_RECOGNIZE_PRODUCT_ACTION = "replica-recognize-product";
export const ECOM_MEDIA_DECOMPOSE_REPLICA_SCRIPT_ACTION = "replica-generate-script";
export const ECOM_MEDIA_DECOMPOSE_REPLICA_SELLING_POINTS_ACTION = "replica-selling-points";
export const ECOM_MEDIA_DECOMPOSE_REPLICA_VOICEOVER_ACTION = "replica-voiceover";

export type MediaDecomposeKind = "image" | "video";
export type MediaDecomposeSource = "upload" | "url" | "asset";

export type MediaDecomposeReference = {
  id: string;
  kind: MediaDecomposeKind;
  ossUrl: string;
  source: MediaDecomposeSource;
  sourceUrl?: string;
  label?: string;
};

export type MediaDecomposeSettings = {
  chatModelKey?: string;
  lastPrompt?: string;
};

export type MediaDecomposeResult = {
  rawText?: string;
  structured?: MediaDecomposePatch | null;
  parseError?: string | null;
  completedAt?: string;
};

export type MediaDecomposeProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: MediaDecomposeSettings;
  media: MediaDecomposeReference | null;
  result: MediaDecomposeResult | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

const refSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["image", "video"]),
  ossUrl: z.string().url(),
  source: z.enum(["upload", "url", "asset"]),
  sourceUrl: z.string().optional(),
  label: z.string().optional(),
});

export function sanitizeMediaDecomposeReference(raw: unknown): MediaDecomposeReference | null {
  const parsed = refSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function sanitizeMediaDecomposeSettings(raw: unknown): MediaDecomposeSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    chatModelKey:
      typeof o.chatModelKey === "string" && o.chatModelKey.trim()
        ? o.chatModelKey.trim()
        : undefined,
    lastPrompt:
      typeof o.lastPrompt === "string" && o.lastPrompt.trim()
        ? o.lastPrompt.trim()
        : undefined,
  };
}

export function sanitizeMediaDecomposeResult(raw: unknown): MediaDecomposeResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rawText = typeof o.rawText === "string" ? o.rawText : undefined;
  const fromRaw = rawText?.trim() ? extractMediaDecomposePatch(rawText) : null;
  const structured =
    fromRaw ??
    (o.structured && typeof o.structured === "object"
      ? normalizeMediaDecomposePatch(o.structured as MediaDecomposePatch)
      : o.structured === null
        ? null
        : undefined);
  return {
    rawText,
    structured,
    parseError: typeof o.parseError === "string" ? o.parseError : o.parseError === null ? null : undefined,
    completedAt: typeof o.completedAt === "string" ? o.completedAt : undefined,
  };
}

export type { MediaDecomposePatch };
