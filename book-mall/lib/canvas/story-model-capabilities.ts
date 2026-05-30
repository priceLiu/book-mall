/**
 * 影视专业版 · 模型能力（服务端 runner 校验，与 canvas-web 语义一致）
 */

export type StoryModelCapability =
  | "image_t2i"
  | "image_multi_ref"
  | "video_i2v"
  | "video_r2v"
  | "video_t2v"
  | "video_multi_ref";

export class StoryModelCapabilityError extends Error {
  readonly code = "MODEL_CAPABILITY_MISMATCH" as const;
  readonly httpStatus = 400;

  constructor(message: string) {
    super(message);
    this.name = "StoryModelCapabilityError";
  }
}

const EXPLICIT: Record<string, StoryModelCapability[]> = {
  "nano-banana-pro": ["image_t2i", "image_multi_ref"],
  "hunyuan-3d-pro": ["image_t2i", "image_multi_ref"],
  "hunyuan-3d-express": ["image_t2i", "image_multi_ref"],
  "google/nano-banana-pro": ["image_t2i", "image_multi_ref"],
  "flux-2-pro": ["image_t2i", "image_multi_ref"],
  "seedream-5-lite": ["image_t2i", "image_multi_ref"],
  "seedream-4.5": ["image_t2i", "image_multi_ref"],
  "gpt-image-2": ["image_t2i", "image_multi_ref"],
  "gpt-image-1": ["image_t2i", "image_multi_ref"],
  "bytedance/seedream-v4-text-to-image": ["image_t2i", "image_multi_ref"],
  "flux-kontext-pro": ["image_t2i", "image_multi_ref"],
  "flux-kontext-max": ["image_t2i", "image_multi_ref"],
  "qwen-text-to-image": ["image_t2i"],
  "bytedance/seedance-2": ["video_i2v", "video_r2v", "video_multi_ref"],
  "happyhorse-1.0-r2v": ["video_r2v", "video_multi_ref"],
  "wan2.6-r2v": ["video_r2v", "video_multi_ref"],
  "wan2.6-r2v-flash": ["video_r2v", "video_multi_ref"],
  "wan2.7-r2v": ["video_r2v", "video_multi_ref"],
};

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

export function assertStoryModelCapabilities(
  modelKey: string,
  required: StoryModelCapability[],
  context?: string,
): void {
  if (!required.length || modelHasStoryCapabilities(modelKey, required)) return;
  const prefix = context ? `${context}：` : "";
  throw new StoryModelCapabilityError(
    `${prefix}模型「${modelKey}」不支持所需能力（${required.join("、")}）`,
  );
}
