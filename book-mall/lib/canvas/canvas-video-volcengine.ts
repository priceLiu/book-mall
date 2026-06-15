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

function isFrameContentRole(role: string | undefined): boolean {
  return role === "first_frame" || role === "last_frame";
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
  aspectRatio?: string;
  lastFrameUrl?: string;
  /** true = 强制 reference_image 分支（智能多帧 / 全能多图） */
  forceReferenceMode?: boolean;
}): { model: string; body: Record<string, unknown> } {
  if (!isVolcengineStoryVideoModelKey(args.modelKey)) {
    throw new Error(`unsupported volcengine video model: ${args.modelKey}`);
  }

  const mainUrl = normalizeMediaUrl(args.imageUrl) ?? "";
  const allowMultiRef = volcengineVideoSupportsMultiRef(args.modelKey);
  const extraRefImages = allowMultiRef
    ? (args.referenceImageUrls ?? [])
        .map((u) => normalizeMediaUrl(u))
        .filter((u): u is string => Boolean(u) && u !== mainUrl)
    : [];

  const refVideos = allowMultiRef
    ? (args.referenceVideoUrls ?? [])
        .map((u) => normalizeMediaUrl(u))
        .filter((u): u is string => u != null && isHttpUrl(u))
        .slice(0, 4)
    : [];

  const refAudios = allowMultiRef
    ? (args.referenceAudioUrls ?? [])
        .map((u) => normalizeMediaUrl(u))
        .filter((u): u is string => u != null && isHttpUrl(u))
        .slice(0, 4)
    : [];

  const assetRefs = (args.assetRefs ?? [])
    .map((ref) => {
      const url = normalizeMediaUrl(ref.url);
      if (!url || !isAssetRef(url)) return null;
      return { url, role: ref.role ?? "reference_image" };
    })
    .filter((r): r is { url: string; role: "reference_image" | "first_frame" } => r != null);

  const frameAssets = assetRefs.filter((r) => isFrameContentRole(r.role));
  const referenceAssets = assetRefs.filter((r) => !isFrameContentRole(r.role));
  const lastFrameHttp = normalizeMediaUrl(args.lastFrameUrl ?? "");

  // 方舟 API：first/last frame 与 reference_image/video/audio 互斥，不可同请求混用。
  const useReferenceMode =
    args.forceReferenceMode === true ||
    (allowMultiRef &&
      (extraRefImages.length > 0 ||
        refVideos.length > 0 ||
        refAudios.length > 0 ||
        referenceAssets.length > 0));

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: args.prompt },
  ];

  if (useReferenceMode) {
    const refImages = [
      ...(mainUrl ? [mainUrl] : []),
      ...extraRefImages,
    ].filter((u, i, arr) => arr.indexOf(u) === i);

    for (const url of refImages.slice(0, 9)) {
      content.push({
        type: "image_url",
        image_url: { url },
        role: "reference_image",
      });
    }

    for (const ref of referenceAssets.slice(0, 8)) {
      content.push({
        type: "image_url",
        image_url: { url: ref.url },
        role: "reference_image",
      });
    }

    for (const url of refVideos) {
      content.push({
        type: "video_url",
        video_url: { url },
        role: "reference_video",
      });
    }

    for (const url of refAudios) {
      content.push({
        type: "audio_url",
        audio_url: { url },
        role: "reference_audio",
      });
    }
  } else {
    if (mainUrl) {
      content.push({
        type: "image_url",
        image_url: { url: mainUrl },
        role: "first_frame",
      });
    }

    for (const ref of frameAssets.slice(0, 1)) {
      content.push({
        type: "image_url",
        image_url: { url: ref.url },
        role: ref.role,
      });
    }

    if (lastFrameHttp && lastFrameHttp !== mainUrl) {
      content.push({
        type: "image_url",
        image_url: { url: lastFrameHttp },
        role: "last_frame",
      });
    }
  }

  const resolution = String(args.options?.resolution ?? "1080p").toLowerCase();
  const durationRaw = Number(args.options?.duration ?? 15);
  const duration = Number.isFinite(durationRaw)
    ? Math.min(15, Math.max(4, Math.round(durationRaw)))
    : 15;

  const ratio = resolveVolcengineVideoRatio(args.aspectRatio);

  return {
    model: args.modelKey,
    body: {
      content,
      resolution,
      ratio,
      duration,
      watermark: args.options?.watermark === true,
      generate_audio: args.options?.generateAudio === true,
    },
  };
}

/** UI `auto` → 方舟 API `adaptive` */
export function resolveVolcengineVideoRatio(aspectRatio?: string): string {
  const raw = String(aspectRatio ?? "16:9")
    .trim()
    .toLowerCase();
  if (raw === "auto" || raw === "adaptive") return "adaptive";
  return raw || "16:9";
}
