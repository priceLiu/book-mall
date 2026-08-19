import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";
import type { StoryLlmSection } from "./story-workspace-types";

/** 2.0 脚本 hub LLM 顺序（单段 regenerate 仍用 character/scene/storyboard） */
export const PRO2_HUB_SECTION_ORDER: StoryLlmSection[] = [
  "outline",
  "character",
  "scene",
  "storyboard",
];

/** 2.0 脚本 hub · 统一单次 full_pack JSON（禁止四段顺序 LLM） */
export function resolvePro2HubScriptGenerationSections(
  _effectiveOutline: string,
  _scriptCategoryId?: Pro2ScriptCategoryId,
): StoryLlmSection[] {
  return ["outline"];
}
