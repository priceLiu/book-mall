/**
 * Canvas 分镜视频 · 火山方舟 Seedance 入参（contents/generations/tasks）
 */
import {
  VOLCENGINE_VIDEO_MODEL_KEYS,
} from "@/lib/gateway/volcengine-chat-models";

export function isVolcengineStoryVideoModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  if (k.startsWith("ep-")) return true;
  return VOLCENGINE_VIDEO_MODEL_KEYS.has(k);
}

/** 影视专业版 · 多 @ 参考时默认升级的方舟 Seedance 模型 */
export const VOLCENGINE_VIDEO_MULTI_REF_MODEL = "doubao-seedance-2.0";

/** Seedance 2.0 支持 reference_image；1.5 Pro 仅首帧/尾帧，不可与参考图混用 */
export function volcengineVideoSupportsMultiRef(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k === "doubao-seedance-2.0" || k.includes("seedance-2.0") || k.startsWith("ep-");
}

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//.test(u);
}

function isAssetRef(u: string): boolean {
  return u.startsWith("asset://");
}

function normalizeMediaUrl(u: string): string | null {
  const t = u.trim();
  if (!t) return null;
  if (isHttpUrl(t) || isAssetRef(t)) return t;
  return null;
}

export function buildCanvasVideoVolcengineInput(args: {
  modelKey: string;
  prompt: string;
  imageUrl: string;
  referenceImageUrls?: string[];
  referenceVideoUrls?: string[];
  referenceAudioUrls?: string[];
  /** 人像库 asset://asset-xxx */
  assetRefs?: Array<{ url: string; role?: "reference_image" | "first_frame" }>;
  options?: {
    resolution?: string;
    duration?: number;
    generateAudio?: boolean;
    watermark?: boolean;
  };
  aspectRatio?: "16:9" | "9:16";
}): { model: string; body: Record<string, unknown> } {
  if (!isVolcengineStoryVideoModelKey(args.modelKey)) {
    throw new Error(`unsupported volcengine video model: ${args.modelKey}`);
  }

  const mainUrl = normalizeMediaUrl(args.imageUrl) ?? "";
  const allowMultiRef = volcengineVideoSupportsMultiRef(args.modelKey);
  const extraRefs = allowMultiRef
    ? (args.referenceImageUrls ?? [])
        .map((u) => normalizeMediaUrl(u))
        .filter((u): u is string => Boolean(u) && u !== mainUrl)
    : [];

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: args.prompt },
  ];

  if (mainUrl) {
    content.push({
      type: "image_url",
      image_url: { url: mainUrl },
      role: "first_frame",
    });
  }

  for (const url of extraRefs.slice(0, 8)) {
    content.push({
      type: "image_url",
      image_url: { url },
      role: "reference_image",
    });
  }

  for (const ref of args.assetRefs ?? []) {
    const url = normalizeMediaUrl(ref.url);
    if (!url || !isAssetRef(url)) continue;
    content.push({
      type: "image_url",
      image_url: { url },
      role: ref.role ?? "reference_image",
    });
  }

  for (const url of (args.referenceVideoUrls ?? [])
    .map((u) => normalizeMediaUrl(u))
    .filter((u): u is string => u != null && isHttpUrl(u))
    .slice(0, 4)) {
    content.push({
      type: "video_url",
      video_url: { url },
      role: "reference_video",
    });
  }

  for (const url of (args.referenceAudioUrls ?? [])
    .map((u) => normalizeMediaUrl(u))
    .filter((u): u is string => u != null && isHttpUrl(u))
    .slice(0, 4)) {
    content.push({
      type: "audio_url",
      audio_url: { url },
      role: "reference_audio",
    });
  }

  const resolution = String(args.options?.resolution ?? "1080p").toLowerCase();
  const durationRaw = Number(args.options?.duration ?? 5);
  const duration = Number.isFinite(durationRaw)
    ? Math.min(15, Math.max(4, Math.round(durationRaw)))
    : 5;

  return {
    model: args.modelKey,
    body: {
      content,
      resolution,
      ratio: args.aspectRatio ?? "16:9",
      duration,
      watermark: args.options?.watermark === true,
      generate_audio: args.options?.generateAudio === true,
    },
  };
}
