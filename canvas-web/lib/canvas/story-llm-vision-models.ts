/**
 * book-mall/lib/canvas/story-llm-vision-models.ts 须保持同步
 * 支持 messages 内 image_url 多模态的 Story LLM（图片/视频反推提示词）
 */

export const STORY_LLM_VISION_MODEL_KEYS = [
  "doubao-seed-2.1-pro",
  "doubao-seed-2.0",
  "google/gemini-3-flash-preview",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gpt-5-5",
] as const;

const VISION_SET = new Set<string>(STORY_LLM_VISION_MODEL_KEYS);

export function isStoryLlmVisionModel(modelKey: string): boolean {
  return VISION_SET.has(modelKey.trim());
}
