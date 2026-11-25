import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

/** 与 book-mall story-llm-vision-models 保持一致 */
export const HIT_REPLICA_VISION_CHAT_MODEL_KEYS = [
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

export const HIT_REPLICA_DEFAULT_VISION_MODEL = "qwen3.8-max";

const VISION_SET = new Set<string>(HIT_REPLICA_VISION_CHAT_MODEL_KEYS);

export function isHitReplicaVisionChatModel(modelKey: string): boolean {
  return VISION_SET.has(modelKey.trim());
}

export function filterHitReplicaVisionChatModels(
  models: StoryboardGatewayModel[],
): StoryboardGatewayModel[] {
  return models.filter((m) => isHitReplicaVisionChatModel(m.modelKey));
}

export function pickHitReplicaVisionModelKey(opts: {
  models: StoryboardGatewayModel[];
  preferred: string;
}): string {
  const usable = (m: StoryboardGatewayModel) =>
    m.credentialBound || m.platformOffering;
  const preferred = opts.preferred.trim();
  if (preferred && isHitReplicaVisionChatModel(preferred)) {
    const hit = opts.models.find((m) => m.modelKey === preferred);
    if (hit && usable(hit)) return preferred;
  }
  const defaultHit = opts.models.find(
    (m) => m.modelKey === HIT_REPLICA_DEFAULT_VISION_MODEL && usable(m),
  );
  if (defaultHit) return defaultHit.modelKey;
  const anyVision = opts.models.find(
    (m) => isHitReplicaVisionChatModel(m.modelKey) && usable(m),
  );
  return anyVision?.modelKey ?? HIT_REPLICA_DEFAULT_VISION_MODEL;
}