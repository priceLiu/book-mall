import type { MediaDecomposeChatModel, MediaDecomposeKind } from "@/lib/media-decompose-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";

/** 与 book-mall ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL / ECOM_DEFAULT_VISION_MODEL 一致 */
export const ECOM_MEDIA_DECOMPOSE_DEFAULT_VISION_MODEL = "qwen3.8-max";

export function listEligibleMediaDecomposeChatModels(
  models: MediaDecomposeChatModel[],
  mediaKind?: MediaDecomposeKind | null,
): MediaDecomposeChatModel[] {
  if (mediaKind === "video") {
    return models.filter((m) => m.supportsVideo);
  }
  return models;
}

/** 拆解用模型：须在 Vision 白名单内；视频素材须 supportsVideo */
export function pickMediaDecomposeChatModelKey(
  models: MediaDecomposeChatModel[],
  preferred: string,
  mediaKind?: MediaDecomposeKind | null,
): string {
  const eligible = listEligibleMediaDecomposeChatModels(models, mediaKind);
  if (eligible.length === 0) {
    return preferred.trim() || ECOM_MEDIA_DECOMPOSE_DEFAULT_VISION_MODEL;
  }
  const seed = preferred.trim() || ECOM_MEDIA_DECOMPOSE_DEFAULT_VISION_MODEL;
  return pickBoundStoryboardModelKey(eligible, seed);
}

export function isMediaDecomposeChatModelEligible(
  modelKey: string,
  models: MediaDecomposeChatModel[],
  mediaKind?: MediaDecomposeKind | null,
): boolean {
  return listEligibleMediaDecomposeChatModels(models, mediaKind).some(
    (m) => m.modelKey === modelKey,
  );
}
