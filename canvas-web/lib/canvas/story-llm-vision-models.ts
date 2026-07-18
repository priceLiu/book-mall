/**
 * book-mall/lib/canvas/story-llm-vision-models.ts 须保持同步
 * 支持 messages 内 image_url / video_url 多模态的 Story LLM（图片/视频反推提示词）
 */

/** Pro2 文本节点 · 视频反推（百炼 Qwen 视频理解） */
export const STORY_LLM_VIDEO_UNDERSTANDING_MODEL_KEYS = [
  "qwen3-vl-plus",
  "qwen3.7-plus",
  "qwen3.5-plus",
] as const;

export const STORY_LLM_VISION_MODEL_KEYS = [
  ...STORY_LLM_VIDEO_UNDERSTANDING_MODEL_KEYS,
  "doubao-seed-2.1-pro",
  "doubao-seed-2.0",
  "google/gemini-3-flash-preview",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gpt-5-5",
] as const;

const VISION_SET = new Set<string>(STORY_LLM_VISION_MODEL_KEYS);
const VIDEO_UNDERSTANDING_SET = new Set<string>(
  STORY_LLM_VIDEO_UNDERSTANDING_MODEL_KEYS,
);

export function isStoryLlmVisionModel(modelKey: string): boolean {
  return VISION_SET.has(modelKey.trim());
}

export function isStoryLlmVideoUnderstandingModel(modelKey: string): boolean {
  return VIDEO_UNDERSTANDING_SET.has(modelKey.trim());
}

export function assertStoryLlmVisionModel(
  modelKey: string,
  context?: string,
): void {
  if (isStoryLlmVisionModel(modelKey)) return;
  const prefix = context ? `${context}：` : "";
  throw new Error(
    `${prefix}模型「${modelKey}」不支持图片/视频理解，请换用 Qwen3-VL、Qwen3.7 Plus、Gemini 3 Flash 或 GPT-5.5`,
  );
}
