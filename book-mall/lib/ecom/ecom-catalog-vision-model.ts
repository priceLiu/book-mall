import {
  assertStoryLlmVisionModel,
  isStoryLlmVisionModel,
  STORY_LLM_DEFAULT_VISION_MODEL,
} from "@/lib/canvas/story-llm-vision-models";

/** 风格/场景入库 · 视觉 LLM（与反推共用 Gateway 模型白名单，不走 decompose prompt） */
export function resolveCatalogVisionModelKey(modelKey?: string): string {
  let key = modelKey?.trim() || STORY_LLM_DEFAULT_VISION_MODEL;
  if (!isStoryLlmVisionModel(key)) {
    key = STORY_LLM_DEFAULT_VISION_MODEL;
  }
  assertStoryLlmVisionModel(key, "风格/场景入库");
  return key;
}
