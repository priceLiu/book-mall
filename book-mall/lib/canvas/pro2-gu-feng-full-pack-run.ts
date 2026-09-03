import {
  STORY_PRO2_HUB_LLM_SYSTEM,
} from "./story-pro2-theme-outline-prompt";
import {
  PRO2_GU_FENG_DEEPSEEK_STORY_INPUT_PREFIX,
  PRO2_GU_FENG_DEEPSEEK_SYSTEM_PROMPT,
} from "./data/pro2-gu-feng-deepseek-full-pack-prompt";
import {
  appendPro2ParseContract,
  buildPro2FullPackUserPrompt,
  isPro2FullPackRun,
  resolveUserScriptPromptTemplate,
} from "./pro2-pack-parse-contract";
import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

export { isPro2FullPackRun, resolveUserScriptPromptTemplate };

/** @deprecated 使用 isPro2FullPackRun */
export function isPro2GuFengFullPackRun(
  scriptCategoryId: Pro2ScriptCategoryId | undefined,
  effectiveOutline: string,
): boolean {
  return isPro2FullPackRun(effectiveOutline);
}

export function resolvePro2FullPackSystemPrompt(
  scriptCategoryId?: Pro2ScriptCategoryId,
): string {
  if (scriptCategoryId === "gu-feng-tian-chong") {
    return PRO2_GU_FENG_DEEPSEEK_SYSTEM_PROMPT;
  }
  return STORY_PRO2_HUB_LLM_SYSTEM;
}

/** @deprecated */
export const resolvePro2GuFengFullPackSystemPrompt = resolvePro2FullPackSystemPrompt;

/** 写入 hub promptOutline / Gateway user 的规则段（不含故事正文） */
export function buildPro2FullPackOutlineUserPrompt(
  hub: Pick<
    StoryProScriptHubNodeData,
    "scriptCategoryId" | "scriptCategoryDocBody" | "dockInput"
  >,
  outlineMd: string,
): string {
  const template = resolveUserScriptPromptTemplate(hub);
  return buildPro2FullPackUserPrompt(
    template,
    outlineMd,
    hub.scriptCategoryId,
  );
}

/** @deprecated 使用 buildPro2FullPackOutlineUserPrompt */
export function buildPro2GuFengFullPackUserPrompt(outlineMd: string): string {
  return appendPro2ParseContract({ outlineMd, scriptCategoryId: "gu-feng-tian-chong" });
}

/** 故事正文 · 追加到 textInputs */
export function formatPro2FullPackStoryInput(storyMd: string): string {
  const body = storyMd.trim();
  if (!body) return "";
  return `${PRO2_GU_FENG_DEEPSEEK_STORY_INPUT_PREFIX}\n\n${body}`;
}

/** @deprecated */
export const formatPro2GuFengFullPackStoryInput = formatPro2FullPackStoryInput;

export function resolvePro2OutlinePromptForRun(
  hub: Pick<
    StoryProScriptHubNodeData,
    "scriptCategoryId" | "scriptCategoryDocBody" | "dockInput"
  >,
  effectiveOutline: string,
  _defaultOutlinePrompt: string,
): string {
  return buildPro2FullPackOutlineUserPrompt(hub, effectiveOutline);
}

/** @deprecated */
export function resolvePro2GuFengOutlinePromptForRun(
  scriptCategoryId: Pro2ScriptCategoryId | undefined,
  effectiveOutline: string,
  defaultOutlinePrompt: string,
): string {
  if (!isPro2FullPackRun(effectiveOutline)) {
    return defaultOutlinePrompt;
  }
  return buildPro2FullPackUserPrompt(
    defaultOutlinePrompt,
    effectiveOutline,
    scriptCategoryId,
  );
}
