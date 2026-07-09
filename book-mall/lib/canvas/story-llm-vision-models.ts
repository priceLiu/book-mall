/**
 * canvas-web/lib/canvas/story-llm-vision-models.ts 须保持同步
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

export function assertStoryLlmVisionModel(
  modelKey: string,
  context?: string,
): void {
  if (isStoryLlmVisionModel(modelKey)) return;
  const prefix = context ? `${context}：` : "";
  throw new Error(
    `${prefix}模型「${modelKey}」不支持图片理解，请换用 Doubao Seed 2.1 Pro、Gemini 3 Flash 或 GPT-5.5`,
  );
}
