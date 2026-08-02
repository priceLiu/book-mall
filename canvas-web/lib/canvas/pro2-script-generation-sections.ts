import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";
import type { StoryLlmSection } from "./story-workspace-types";
import { isPro2FullPackRun } from "./pro2-pack-parse-contract";

/** 2.0 脚本 hub LLM 顺序：大纲 → 角色 → 场景 → 分镜 */
export const PRO2_HUB_SECTION_ORDER: StoryLlmSection[] = [
  "outline",
  "character",
  "scene",
  "storyboard",
];

/** 已有大纲真源 → 单次 outline 全量制作包；无大纲 → 四段顺序 */
export function resolvePro2HubScriptGenerationSections(
  effectiveOutline: string,
  _scriptCategoryId?: Pro2ScriptCategoryId,
): StoryLlmSection[] {
  if (isPro2FullPackRun(effectiveOutline)) {
    return ["outline"];
  }
  return [...PRO2_HUB_SECTION_ORDER];
}
