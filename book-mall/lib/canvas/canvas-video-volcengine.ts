/**
 * Canvas 分镜视频 · 火山方舟 Seedance 入参（contents/generations/tasks）
 */
import {
  VOLCENGINE_VIDEO_MODEL_KEYS,
} from "@/lib/gateway/volcengine-chat-models";

export function isVolcengineStoryVideoModelKey(modelKey: string): boolean {
  return VOLCENGINE_VIDEO_MODEL_KEYS.has(modelKey.trim().toLowerCase());
}

/** 影视专业版 · 多 @ 参考时默认升级的方舟 Seedance 模型 */
export const VOLCENGINE_VIDEO_MULTI_REF_MODEL = "doubao-seedance-2.0";

export function buildCanvasVideoVolcengineInput(args: {
  modelKey: string;
  prompt: string;
  imageUrl: string;
  referenceImageUrls?: string[];
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

  const mainUrl = args.imageUrl.trim();
  const extraRefs = (args.referenceImageUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u) && u !== mainUrl);

  const imageUrls = [mainUrl, ...extraRefs].slice(0, 9);

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: args.prompt },
  ];
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
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
