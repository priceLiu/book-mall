/** 厂商生图 API 常见上限（如 KIE nano-banana） */
export const STORY_PRO_IMAGE_PROMPT_MAX = 5000;

export function clampStoryProImagePrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= STORY_PRO_IMAGE_PROMPT_MAX) return trimmed;
  return trimmed.slice(0, STORY_PRO_IMAGE_PROMPT_MAX);
}
