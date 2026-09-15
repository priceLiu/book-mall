/**
 * 分镜视频 1.0 · DashScope 原生文生视频（wan / HappyHorse）
 */
import { isDashscopeWan30VideoModelKey } from "@/lib/gateway/dashscope-client";
import { isLikelyReferenceImageUrl } from "./media-url-kind";

export const DASHSCOPE_SBV1_WAN_T2V_MODEL_KEYS = [
  "wan2.6-t2v",
  "wan2.7-t2v",
  "wan2.7-t2v-2026-04-25",
  "wan3.0-video",
  "wan3.0-video-prime",
] as const;

export const DASHSCOPE_HAPPYHORSE_T2V_MODEL_KEYS = [
  "happyhorse-1.0-t2v",
  "happyhorse-1.1-t2v",
] as const;

export const DASHSCOPE_HAPPYHORSE_I2V_MODEL_KEYS = [
  "happyhorse-1.0-i2v",
  "happyhorse-1.1-i2v",
] as const;

export const DASHSCOPE_SBV1_T2V_MODEL_KEYS = [
  ...DASHSCOPE_SBV1_WAN_T2V_MODEL_KEYS,
  ...DASHSCOPE_HAPPYHORSE_T2V_MODEL_KEYS,
] as const;

export type DashscopeSbv1T2vModelKey =
  (typeof DASHSCOPE_SBV1_T2V_MODEL_KEYS)[number];

export function isDashscopeWan30VideoModel(modelKey: string): boolean {
  return isDashscopeWan30VideoModelKey(modelKey);
}

export function isDashscopeHappyhorseTextToVideoModel(modelKey: string): boolean {
  return (DASHSCOPE_HAPPYHORSE_T2V_MODEL_KEYS as readonly string[]).includes(
    modelKey.trim(),
  );
}

export function isDashscopeHappyhorseImageToVideoModel(modelKey: string): boolean {
  return (DASHSCOPE_HAPPYHORSE_I2V_MODEL_KEYS as readonly string[]).includes(
    modelKey.trim(),
  );
}

export function isDashscopeSbv1TextToVideoModel(modelKey: string): boolean {
  return (DASHSCOPE_SBV1_T2V_MODEL_KEYS as readonly string[]).includes(
    modelKey.trim(),
  );
}

/** 文生视频模型 · 对应参考生视频 R2V（百炼 media） */
const DASHSCOPE_SBV1_T2V_TO_R2V: Record<string, string> = {
  "happyhorse-1.0-t2v": "happyhorse-1.0-r2v",
  "happyhorse-1.1-t2v": "happyhorse-1.1-r2v",
  "wan2.6-t2v": "wan2.6-r2v",
  "wan2.7-t2v": "wan2.7-r2v",
  "wan2.7-t2v-2026-04-25": "wan2.7-r2v",
};

export function dashscopeSbv1T2vModelToR2v(modelKey: string): string | null {
  return DASHSCOPE_SBV1_T2V_TO_R2V[modelKey.trim()] ?? null;
}

/** T2V + 参考图时不自动升 R2V；返回用户可读错误文案，无冲突则 null */
export function resolveDashscopeT2vRefMismatchMessage(
  modelKey: string,
  referenceImageUrls: readonly string[],
): string | null {
  const trimmed = modelKey.trim();
  if (!isDashscopeSbv1TextToVideoModel(trimmed)) return null;
  /** 万相 3.0 为 All-in-One，官方支持参考图 / 首尾帧，不升 R2V */
  if (isDashscopeWan30VideoModel(trimmed)) return null;
  const refCount = referenceImageUrls.filter((u) => u.trim().length > 0).length;
  if (refCount <= 0) return null;
  const r2vKey = dashscopeSbv1T2vModelToR2v(trimmed);
  const r2vHint = r2vKey ? `「${r2vKey}」` : "参考生视频（R2V）模型";
  return `文生视频模型「${trimmed}」不支持参考图（已添加 ${refCount} 张）。请在模型列表中选择 ${r2vHint}，或移除参考图后再生成。`;
}

const T2V_ASPECT_TO_SIZE: Record<string, readonly [string, string]> = {
  "16:9": ["1280*720", "1920*1080"],
  "9:16": ["720*1280", "1080*1920"],
  "1:1": ["720*720", "1080*1080"],
  "4:3": ["960*720", "1440*1080"],
  "3:4": ["720*960", "1080*1440"],
};

function t2vAspectRatioToSize(
  aspect: string,
  resolution: "720P" | "1080P",
): string {
  const pair = T2V_ASPECT_TO_SIZE[aspect.trim()] ?? T2V_ASPECT_TO_SIZE["16:9"]!;
  return resolution === "1080P" ? pair[1] : pair[0];
}

function parseResolution(raw: string): "480P" | "720P" | "1080P" {
  const t = raw.trim().toUpperCase();
  if (t.startsWith("480")) return "480P";
  if (t.startsWith("1080")) return "1080P";
  return "720P";
}

export type DashscopeWan30MediaItem = {
  type:
    | "first_frame"
    | "last_frame"
    | "reference_image"
    | "reference_video"
    | "reference_audio";
  url: string;
};

export type DashscopeWan30DockMode = "first_last" | "i2v" | "omni";

function dedupeMediaUrls(urls: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls ?? []) {
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function buildDashscopeWan30Media(opts: {
  dockMode?: DashscopeWan30DockMode;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceImageUrls?: readonly string[];
  referenceVideoUrls?: readonly string[];
  referenceAudioUrls?: readonly string[];
}): DashscopeWan30MediaItem[] {
  const first = opts.firstFrameUrl?.trim() ?? "";
  const last = opts.lastFrameUrl?.trim() ?? "";
  const videos = dedupeMediaUrls(opts.referenceVideoUrls).slice(0, 5);
  const audios = dedupeMediaUrls(opts.referenceAudioUrls).slice(0, 5);
  const refs = dedupeMediaUrls(opts.referenceImageUrls).filter(
    (u) => u !== first && u !== last && isLikelyReferenceImageUrl(u),
  );
  const firstImage =
    first && isLikelyReferenceImageUrl(first) ? first : "";
  const lastImage = last && isLikelyReferenceImageUrl(last) ? last : "";
  const hasOmniMedia = videos.length > 0 || audios.length > 0;
  const dockMode =
    opts.dockMode ??
    (hasOmniMedia
      ? "omni"
      : refs.length > 0
        ? "first_last"
        : firstImage
          ? "i2v"
          : "first_last");

  // 参考生视频 / 全能参考：reference_*（可与视频/音频/多图组合，不可与 first/last 混传）
  if (dockMode === "omni" || hasOmniMedia) {
    const media: DashscopeWan30MediaItem[] = [];
    for (const url of videos) {
      media.push({ type: "reference_video", url });
    }
    /** omni · 全部 reference_image（勿拆 firstFrame，否则多图时首张会被误剔除） */
    const omniImages =
      dockMode === "omni" || hasOmniMedia
        ? dedupeMediaUrls(opts.referenceImageUrls).filter((u) =>
            isLikelyReferenceImageUrl(u),
          )
        : [];
    const imageUrls =
      omniImages.length > 0
        ? omniImages
        : refs.length > 0
          ? refs
          : firstImage
            ? [firstImage]
            : [];
    for (const url of imageUrls.slice(0, 10)) {
      media.push({ type: "reference_image", url });
    }
    for (const url of audios) {
      media.push({ type: "reference_audio", url });
    }
    if (media.length > 0) return media;
  }

  // 万相 3.0 API：first_frame 仅可与 last_frame 同用，不可与 reference_image 混传。
  if (refs.length > 0) {
    const seen = new Set<string>();
    const allRefs: string[] = [];
    for (const url of [firstImage, ...refs]) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      allRefs.push(url);
    }
    return allRefs.slice(0, 10).map((url) => ({
      type: "reference_image" as const,
      url,
    }));
  }

  const media: DashscopeWan30MediaItem[] = [];
  if (firstImage) media.push({ type: "first_frame", url: firstImage });
  if (lastImage) media.push({ type: "last_frame", url: lastImage });
  return media.slice(0, 10);
}

function parseWan30Ratio(
  aspectRatio: string,
  media: DashscopeWan30MediaItem[],
): string {
  const hasVideo = media.some((m) => m.type === "reference_video");
  if (hasVideo) return "adaptive";
  const t = aspectRatio.trim();
  const allowed = ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"] as const;
  if ((allowed as readonly string[]).includes(t)) return t;
  return "16:9";
}

export function buildDashscopeWan30VideoBody(opts: {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  seed?: number;
  watermark?: boolean;
  promptExtend?: boolean;
  generateAudio?: boolean;
  media?: DashscopeWan30MediaItem[];
}): { input: Record<string, unknown>; parameters: Record<string, unknown> } {
  const prompt = opts.prompt.trim();
  const media = (opts.media ?? []).filter((m) => m.url.trim().length > 0);
  if (!prompt && media.length === 0) {
    throw new Error("prompt or media required for wan3.0-video / wan3.0-video-prime");
  }
  const duration = Math.min(30, Math.max(2, Math.floor(opts.durationSec)));
  const parameters: Record<string, unknown> = {
    resolution: parseResolution(opts.resolution),
    ratio: parseWan30Ratio(opts.aspectRatio, media),
    duration,
    watermark: opts.watermark === true,
    prompt_extend: opts.promptExtend !== false,
  };
  if (opts.generateAudio !== undefined) {
    parameters.audio = opts.generateAudio;
  }
  if (opts.seed != null && Number.isInteger(opts.seed)) {
    parameters.seed = opts.seed;
  }
  const input: Record<string, unknown> = {};
  if (prompt) input.prompt = prompt;
  if (media.length > 0) input.media = media;
  return { input, parameters };
}

export function buildDashscopeHappyhorseT2vVideoBody(opts: {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  seed?: number;
  watermark?: boolean;
}): { input: { prompt: string }; parameters: Record<string, unknown> } {
  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("prompt required for text-to-video");
  const duration = Math.min(15, Math.max(3, Math.floor(opts.durationSec)));
  const parameters: Record<string, unknown> = {
    resolution: parseResolution(opts.resolution),
    ratio: opts.aspectRatio.trim() || "16:9",
    duration,
    watermark: opts.watermark === true,
  };
  if (opts.seed != null && Number.isInteger(opts.seed)) {
    parameters.seed = opts.seed;
  }
  return {
    input: { prompt },
    parameters,
  };
}

export function buildDashscopeHappyhorseI2vVideoBody(opts: {
  prompt: string;
  firstFrameUrl: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  seed?: number;
  watermark?: boolean;
}): { input: Record<string, unknown>; parameters: Record<string, unknown> } {
  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("prompt required for image-to-video");
  const first = opts.firstFrameUrl.trim();
  if (!first) throw new Error("first frame image required for image-to-video");
  const duration = Math.min(15, Math.max(3, Math.floor(opts.durationSec)));
  const parameters: Record<string, unknown> = {
    resolution: parseResolution(opts.resolution),
    ratio: opts.aspectRatio.trim() || "16:9",
    duration,
    watermark: opts.watermark === true,
  };
  if (opts.seed != null && Number.isInteger(opts.seed)) {
    parameters.seed = opts.seed;
  }
  return {
    input: {
      prompt,
      media: [{ type: "first_frame", url: first }],
    },
    parameters,
  };
}

export function buildDashscopeSbv1T2vVideoBody(opts: {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  promptExtend?: boolean;
  generateAudio?: boolean;
  modelKey?: string;
  seed?: number;
  watermark?: boolean;
  media?: DashscopeWan30MediaItem[];
}): { input: Record<string, unknown>; parameters: Record<string, unknown> } {
  const modelKey = opts.modelKey?.trim() ?? "";
  if (isDashscopeWan30VideoModel(modelKey)) {
    return buildDashscopeWan30VideoBody(opts);
  }
  if (isDashscopeHappyhorseTextToVideoModel(modelKey)) {
    return buildDashscopeHappyhorseT2vVideoBody(opts);
  }

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("prompt required for text-to-video");
  const res = parseResolution(opts.resolution);
  const sizeRes: "720P" | "1080P" = res === "1080P" ? "1080P" : "720P";
  const dur: 5 | 10 = opts.durationSec <= 7 ? 5 : 10;
  return {
    input: { prompt },
    parameters: {
      size: t2vAspectRatioToSize(opts.aspectRatio, sizeRes),
      duration: dur,
      prompt_extend: opts.promptExtend !== false,
    },
  };
}
