/**
 * Gateway 模型能力标签（图生图 / 图生视频 / 视频生视频等）与路由展示名。
 */
import type { ModelMediaKind } from "@prisma/client";

import marketPresentation from "@/config/gateway-market-presentation.json";

export type MarketTaskTag =
  | "text-to-image"
  | "image-to-image"
  | "image-to-video"
  | "video-to-video"
  | "motion-control"
  | "video-upscale"
  | "text-to-music"
  | "text-to-speech"
  | "chat";

type PresentationFile = {
  models?: Record<string, { taskTags?: string[] }>;
};

const PRESENTATION = marketPresentation as PresentationFile;

function normalizeTaskTag(raw: string): MarketTaskTag | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "-");
  const map: Record<string, MarketTaskTag> = {
    "text-to-image": "text-to-image",
    "image-to-image": "image-to-image",
    "image-to-video": "image-to-video",
    "video-to-video": "video-to-video",
    "text-to-video": "image-to-video",
    "motion-control": "motion-control",
    "video-upscale": "video-upscale",
    "text-to-music": "text-to-music",
    "text-to-speech": "text-to-speech",
    chat: "chat",
  };
  return map[s] ?? null;
}

/** 按 API 能力推断任务标签（同一 modelKey 可对应多个类别）。 */
export function marketTaskTagsForModel(input: {
  canonicalKey: string;
  mediaKind: ModelMediaKind | null;
  requestKind: string;
  role: string;
  modelKey: string;
}): MarketTaskTag[] {
  const preset = PRESENTATION.models?.[input.canonicalKey]?.taskTags;
  if (preset?.length) {
    return [...new Set(preset.map(normalizeTaskTag).filter(Boolean) as MarketTaskTag[])];
  }

  const k = input.modelKey.toLowerCase();
  if (input.requestKind === "CHAT" || input.role === "LLM") {
    if (k.includes("suno")) return ["text-to-music"];
    if (k.startsWith("elevenlabs/")) return ["text-to-speech"];
    return ["chat"];
  }
  if (k.includes("motion-control")) return ["motion-control"];
  if (k.includes("topaz") || k.includes("upscale")) return ["video-upscale"];

  if (k === "google/nano-banana-edit") return ["image-to-image"];
  if (k === "google/nano-banana") return ["text-to-image", "image-to-image"];
  if (k === "4o-image") return ["text-to-image", "image-to-image"];
  if (k === "nano-banana-2") return ["text-to-image", "image-to-image"];

  if (k === "bytedance/seedance-2") return ["image-to-video", "video-to-video"];
  if (k === "bytedance/seedance-2-mini") return ["image-to-video", "video-to-video"];

  if (k === "veo3" || k === "veo3.1" || k === "veo3_fast") {
    return ["image-to-video", "video-to-video"];
  }

  if (k.includes("hailuo") && k.includes("image-to-video")) return ["image-to-video"];
  if (k.includes("kling/v2-5-turbo-image-to-video")) return ["image-to-video"];
  if (k.includes("kling/v2-5-turbo-text-to-video")) return ["image-to-video"];

  if (input.mediaKind === "VIDEO_TO_VIDEO" || k.includes("video-to-video")) {
    return ["video-to-video"];
  }
  if (input.mediaKind === "IMAGE_TO_VIDEO" || k.includes("i2v") || k.includes("image-to-video")) {
    return ["image-to-video"];
  }
  if (input.mediaKind === "TEXT_TO_IMAGE") {
    const tags: MarketTaskTag[] = ["text-to-image"];
    if (
      k.includes("gpt-image") ||
      k.includes("flux") ||
      k.includes("seedream") ||
      k.includes("nano") ||
      k.includes("4o-image") ||
      k.includes("edit")
    ) {
      tags.push("image-to-image");
    }
    return tags;
  }
  return [];
}

export function taskTagsToCapabilities(tags: MarketTaskTag[]): string[] {
  return tags.map((t) =>
    t
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  );
}

/** 路由级展示名（区分文生图 / 图生图 / 独立 video modelKey）。 */
export function gatewayRouteDisplayName(
  catalog: { displayName: string; canonicalKey: string },
  modelKey: string,
): string {
  const mk = modelKey.trim();
  const labels: Record<string, string> = {
    "gpt-image-2": "GPT Image 2 (KIE) T2I/I2I",
    "google/nano-banana": "NanoBanana Gemini 2.5 Flash T2I",
    "google/nano-banana-edit": "NanoBanana Gemini 2.5 Flash I2I",
    "4o-image": "4o Image T2I/I2I",
    "bytedance/seedance-2": "Seedance 2.0 (KIE)",
    "bytedance/seedance-2-mini": "Seedance 2.0 Mini (KIE)",
    veo3: "Veo 3",
    "veo3.1": "Veo 3.1",
    "hailuo/2-3-image-to-video-standard": "Hailuo 2.3 I2V Standard",
    "hailuo/2-3-image-to-video-pro": "Hailuo 2.3 I2V Pro",
    "kling/v2-5-turbo-image-to-video-pro": "Kling 2.5 Turbo I2V",
    "kling/v2-5-turbo-text-to-video-pro": "Kling 2.5 Turbo T2V",
    "suno/generate": "Suno API · 文生音乐",
    "elevenlabs/text-to-dialogue-v3": "ElevenLabs V3",
    "elevenlabs/text-to-speech-multilingual-v2": "ElevenLabs Text to Speech",
  };
  return labels[mk] ?? catalog.displayName;
}

/** Gateway 模型管理页：隐藏 invoke 别名路由，避免同一产品重复展示。 */
export function shouldShowRouteInGatewayCatalog(modelKey: string): boolean {
  const hidden = new Set([
    "gpt-image-2-text-to-image",
    "gpt-image-2-image-to-image",
  ]);
  return !hidden.has(modelKey.trim());
}
