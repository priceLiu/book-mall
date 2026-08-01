import type { StoryLlmSection } from "./story-workspace-types";

/** 2.0 脚本 hub LLM 顺序：大纲 → 角色 → 场景 → 分镜 */
export const PRO2_HUB_SECTION_ORDER: StoryLlmSection[] = [
  "outline",
  "character",
  "scene",
  "storyboard",
];

/** 已有大纲真源时跳过 outline LLM，只跑制作包三段 */
export function resolvePro2HubScriptGenerationSections(
  effectiveOutline: string,
): StoryLlmSection[] {
  return effectiveOutline.trim()
    ? ["character", "scene", "storyboard"]
    : [...PRO2_HUB_SECTION_ORDER];
}
