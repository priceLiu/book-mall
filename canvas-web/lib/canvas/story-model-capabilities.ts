/**
 * 影视专业版 · 模型能力元数据（客户端 EnginePicker / 门禁提示）
 */

export type StoryModelCapability =
  | "image_t2i"
  | "image_multi_ref"
  | "video_i2v"
  | "video_v2v"
  | "video_r2v"
  | "video_t2v"
  | "video_multi_ref";

const EXPLICIT: Record<string, StoryModelCapability[]> = {
  "nano-banana-pro": ["image_t2i", "image_multi_ref"],
  "kling-3.0-image": ["image_t2i", "image_multi_ref"],
  "4o-image": ["image_t2i", "image_multi_ref"],
  "nano-banana-2": ["image_t2i", "image_multi_ref"],
  "google/nano-banana": ["image_t2i", "image_multi_ref"],
  "google/nano-banana-edit": ["image_t2i", "image_multi_ref"],
  "hunyuan-3d-pro": ["image_t2i", "image_multi_ref"],
  "hunyuan-3d-express": ["image_t2i", "image_multi_ref"],
  "google/nano-banana-pro": ["image_t2i", "image_multi_ref"],
  "flux-2-pro": ["image_t2i", "image_multi_ref"],
  "seedream-5-lite": ["image_t2i", "image_multi_ref"],
  "seedream-4.5": ["image_t2i", "image_multi_ref"],
  "gpt-image-2": ["image_t2i", "image_multi_ref"],
  "gpt-image-1": ["image_t2i", "image_multi_ref"],
  "grok-imagine/text-to-image": ["image_t2i"],
  "grok-imagine/image-to-video": ["video_i2v"],
  "grok-imagine-video-1-5-preview": ["video_i2v"],
  "wan/2-6-video-to-video": ["video_v2v"],
  "kling-2.6/motion-control": ["video_v2v"],
  "kling-3.0/motion-control": ["video_v2v"],
  "topaz/video-upscale": ["video_v2v"],
  "topaz-labs/video-enhance": ["video_v2v"],
  "bytedance/seedream-v4-text-to-image": ["image_t2i", "image_multi_ref"],
  "flux-kontext-pro": ["image_t2i", "image_multi_ref"],
  "flux-kontext-max": ["image_t2i", "image_multi_ref"],
  "qwen-text-to-image": ["image_t2i"],
  /** 与 book-mall/lib/canvas/story-model-capabilities.ts 对齐；勿仅靠 infer（seedance 会被误判为 t2v） */
  "kling-2.6/image-to-video": ["video_i2v"],
  "kling/v3-turbo-image-to-video": ["video_i2v"],
  "kling/v3-turbo-text-to-video": ["video_t2v"],
  "kling-3.0/video": ["video_i2v", "video_t2v"],
  "bytedance/seedance-2": ["video_i2v", "video_r2v", "video_multi_ref"],
  "doubao-seedance-2.0": ["video_i2v", "video_r2v", "video_multi_ref"],
  "doubao-seedance-1.5-pro": ["video_i2v"],
  "wan/2-7-image-to-video": ["video_i2v"],
  "happyhorse/image-to-video": ["video_i2v"],
  "happyhorse-1.0-r2v": ["video_r2v", "video_multi_ref"],
  "happyhorse-1.1-r2v": ["video_r2v", "video_multi_ref"],
  "wan2.6-r2v": ["video_r2v", "video_multi_ref"],
  "wan2.6-r2v-flash": ["video_r2v", "video_multi_ref"],
  "wan2.7-r2v": ["video_r2v", "video_multi_ref"],
  "wan2.6-t2v": ["video_t2v"],
  "wan2.7-t2v": ["video_t2v"],
  "wan2.7-t2v-2026-04-25": ["video_t2v"],
};

const VIDEO_CAPABILITY_LABELS: Record<
  Extract<
    StoryModelCapability,
    "video_t2v" | "video_i2v" | "video_r2v" | "video_v2v" | "video_multi_ref"
  >,
  string
> = {
  video_t2v: "文生视频",
  video_i2v: "图生视频",
  video_r2v: "参考生视频",
  video_v2v: "视频生视频",
  video_multi_ref: "多参考图",
};

const VIDEO_CAPABILITY_ORDER: StoryModelCapability[] = [
  "video_t2v",
  "video_i2v",
  "video_r2v",
  "video_v2v",
  "video_multi_ref",
];

function inferCapabilities(modelKey: string): StoryModelCapability[] {
  const k = modelKey.trim().toLowerCase();
  if (!k) return [];

  const explicit = EXPLICIT[k] ?? EXPLICIT[modelKey.trim()];
  if (explicit) return [...explicit];

  const caps: StoryModelCapability[] = [];

  const isVideo =
    k.includes("video") ||
    k.includes("seedance") ||
    k.includes("kling") ||
    k.includes("veo") ||
    k.includes("wan2.") ||
    k.includes("happyhorse");

  if (isVideo) {
    if (k.includes("-r2v") || k.endsWith("r2v")) {
      caps.push("video_r2v");
    }
    if (
      k.includes("image-to-video") ||
      k.includes("i2v") ||
      k.includes("it2v") ||
      k.includes("/i2v")
    ) {
      caps.push("video_i2v");
    }
    if (
      k.includes("text-to-video") ||
      k.includes("t2v") ||
      k.includes("/t2v") ||
      (k.includes("video") && !caps.includes("video_i2v"))
    ) {
      caps.push("video_t2v");
    }
    if (!caps.length) caps.push("video_t2v");
    return caps;
  }

  caps.push("image_t2i");
  if (
    k.includes("nano-banana") ||
    k.includes("flux") ||
    k.includes("seedream") ||
    k.includes("gpt-image") ||
    k.includes("kontext") ||
    k.includes("hunyuan-3d") ||
    (k.includes("gemini") && k.includes("image"))
  ) {
    caps.push("image_multi_ref");
  }
  return caps;
}

export function getStoryModelCapabilities(
  modelKey: string,
): StoryModelCapability[] {
  return inferCapabilities(modelKey);
}

export function modelHasStoryCapabilities(
  modelKey: string,
  required: StoryModelCapability[],
): boolean {
  if (!required.length) return true;
  const have = new Set(getStoryModelCapabilities(modelKey));
  return required.every((c) => have.has(c));
}

export function filterModelKeysByStoryCapabilities(
  keys: readonly string[],
  required: StoryModelCapability[],
): string[] {
  if (!required.length) return [...keys];
  return keys.filter((k) => modelHasStoryCapabilities(k, required));
}

export function storyCapabilityHint(
  required: StoryModelCapability[],
): string {
  const labels: Record<StoryModelCapability, string> = {
    image_t2i: "文生图",
    image_multi_ref: "多参考图",
    video_i2v: "图生视频",
    video_v2v: "视频生视频",
    video_r2v: "参考生视频",
    video_t2v: "文生视频",
    video_multi_ref: "多参考图 API",
  };
  return required.map((c) => labels[c]).join(" · ");
}

/** 视频节点 Dock · 模型能力类型标签（文生视频 / 图生视频 …） */
export function getSbv1VideoModelTypeLabels(modelKey: string): string[] {
  const caps = new Set(getStoryModelCapabilities(modelKey));
  return VIDEO_CAPABILITY_ORDER.filter(
    (c): c is keyof typeof VIDEO_CAPABILITY_LABELS =>
      caps.has(c) && c in VIDEO_CAPABILITY_LABELS,
  ).map((c) => VIDEO_CAPABILITY_LABELS[c]);
}
