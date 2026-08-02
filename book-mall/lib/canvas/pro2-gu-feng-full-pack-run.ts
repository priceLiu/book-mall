import {
  PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT,
  PRO2_GU_FENG_DEEPSEEK_STORY_INPUT_PREFIX,
  PRO2_GU_FENG_DEEPSEEK_SYSTEM_PROMPT,
} from "./data/pro2-gu-feng-deepseek-full-pack-prompt";
import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";
import { buildPro2StoryboardShotBudgetPromptBlock } from "./pro2-storyboard-shot-budget";

/** 古风 + 已有故事大纲 → 单次 DeepSeek 全量制作包（不对齐分段 scene/character/storyboard task） */
export function isPro2GuFengFullPackRun(
  scriptCategoryId: Pro2ScriptCategoryId | undefined,
  effectiveOutline: string,
): boolean {
  return (
    scriptCategoryId === "gu-feng-tian-chong" &&
    Boolean(effectiveOutline.trim())
  );
}

export function resolvePro2GuFengFullPackSystemPrompt(): string {
  return PRO2_GU_FENG_DEEPSEEK_SYSTEM_PROMPT;
}

/** 写入 hub promptOutline / Gateway user 的规则段（不含故事正文） */
export function buildPro2GuFengFullPackUserPrompt(outlineMd: string): string {
  const budget = buildPro2StoryboardShotBudgetPromptBlock(outlineMd);
  return `${PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT}\n\n${budget}`;
}

/** 故事正文 · 追加到 textInputs（对齐 DeepSeek 控制台末尾粘贴大纲） */
export function formatPro2GuFengFullPackStoryInput(storyMd: string): string {
  const body = storyMd.trim();
  if (!body) return "";
  return `${PRO2_GU_FENG_DEEPSEEK_STORY_INPUT_PREFIX}\n\n${body}`;
}

export function resolvePro2GuFengOutlinePromptForRun(
  scriptCategoryId: Pro2ScriptCategoryId | undefined,
  effectiveOutline: string,
  defaultOutlinePrompt: string,
): string {
  if (!isPro2GuFengFullPackRun(scriptCategoryId, effectiveOutline)) {
    return defaultOutlinePrompt;
  }
  return buildPro2GuFengFullPackUserPrompt(effectiveOutline);
}
