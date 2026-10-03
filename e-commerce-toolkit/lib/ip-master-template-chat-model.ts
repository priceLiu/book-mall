import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

/** 与 book-mall story-llm-vision-models 保持一致（识图用） */
export const IP_MASTER_VISION_CHAT_MODEL_KEYS = [
  "qwen3.8-max",
  "qwen3-omni-flash",
  "qwen2.5-vl-72b-instruct",
  "glm-5.3-flash",
  "qwen3-vl-plus",
  "qwen3.7-plus",
  "qwen3.6-plus",
  "qwen3.5-plus",
  "qwen3-vl-flash",
  "doubao-seed-2.1-pro",
  "doubao-seed-2.0",
  "google/gemini-3-flash-preview",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gpt-5-5",
] as const;

const VISION_SET = new Set<string>(IP_MASTER_VISION_CHAT_MODEL_KEYS);

export function isIpMasterVisionChatModel(modelKey: string): boolean {
  return VISION_SET.has(modelKey.trim());
}

export function pickIpMasterTemplateChatModel(opts: {
  models: StoryboardGatewayModel[];
  preferred: string;
  hasBenchmark: boolean;
  defaultChatModelKey: string;
  defaultVisionChatModelKey?: string;
}): string {
  const { models, hasBenchmark } = opts;
  if (models.length === 0) {
    return hasBenchmark
      ? opts.defaultVisionChatModelKey ?? opts.preferred
      : opts.preferred || opts.defaultChatModelKey;
  }

  const isUsable = (m: StoryboardGatewayModel) =>
    m.credentialBound || m.platformOffering;

  if (hasBenchmark) {
    const preferred = opts.preferred.trim();
    if (preferred && isIpMasterVisionChatModel(preferred)) {
      const hit = models.find((m) => m.modelKey === preferred);
      if (hit && isUsable(hit)) return preferred;
    }
    const visionKey = opts.defaultVisionChatModelKey?.trim();
    if (visionKey) {
      const hit = models.find((m) => m.modelKey === visionKey);
      if (hit && isUsable(hit)) return visionKey;
    }
    const anyVision = models.find(
      (m) => isIpMasterVisionChatModel(m.modelKey) && isUsable(m),
    );
    if (anyVision) return anyVision.modelKey;
  }

  const preferredModel = models.find((m) => m.modelKey === opts.preferred);
  if (preferredModel && isUsable(preferredModel)) return preferredModel.modelKey;
  const bound = models.find(isUsable);
  return bound?.modelKey ?? models[0]!.modelKey;
}
