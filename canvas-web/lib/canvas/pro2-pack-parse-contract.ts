/**
 * Pro2 制作包 · 用户创意模板 + 系统解析契约 suffix
 */
import { PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT } from "./data/pro2-gu-feng-deepseek-full-pack-prompt";
import {
  PRO2_HANDOFF_EXAMPLE_ROWS,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_LANGUAGE_RULES,
  STORY_PRO2_PACK_PARSE_CONTRACT,
  STORY_PRO2_PARSE_SELF_CHECK_RULES,
  STORY_PRO2_FIRST_ATTEMPT_HARD_GATES,
} from "./data/pro2-production-pack-standard";
import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";
import { defaultPro2ScriptCategoryDocBody } from "./pro2-script-category-doc";
import { buildPro2StoryboardShotBudgetPromptBlock } from "./pro2-storyboard-shot-budget";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import { STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT } from "./story-pro-script-pack";

export type Pro2ParseContractOptions = {
  outlineMd?: string;
  scriptCategoryId?: Pro2ScriptCategoryId;
};

/** 系统解析契约 suffix（始终追加，不被 category doc scope 裁掉） */
export function appendPro2ParseContract(
  options?: Pro2ParseContractOptions,
): string {
  const parts = [
    STORY_PRO2_PACK_LANGUAGE_RULES.trim(),
    STORY_PRO2_PACK_PARSE_CONTRACT.trim(),
    STORY_PRO2_JSON_OUTPUT_CONTRACT.trim(),
  ];
  const budgetSource = options?.outlineMd?.trim();
  if (budgetSource) {
    parts.push(buildPro2StoryboardShotBudgetPromptBlock(budgetSource));
  }
  parts.push(
    `【交接清单结构参考 · 禁止照抄剧名 · 须依大纲改写】\n${PRO2_HANDOFF_EXAMPLE_ROWS}`,
  );
  parts.push(STORY_PRO2_PARSE_SELF_CHECK_RULES.trim());
  parts.push(STORY_PRO2_FIRST_ATTEMPT_HARD_GATES.trim());
  return parts.join("\n\n");
}

/** chip 模板 > dockInput > 类别默认创意 prompt */
export function resolveUserScriptPromptTemplate(
  hub: Pick<
    StoryProScriptHubNodeData,
    | "scriptCategoryId"
    | "scriptCategoryDocBody"
    | "dockInput"
  >,
): string {
  const custom = hub.dockInput?.trim();
  const categoryId = hub.scriptCategoryId;
  if (categoryId === "custom-prompt" && custom) {
    return custom;
  }
  const docBody = hub.scriptCategoryDocBody?.trim();
  if (docBody) return docBody;
  if (custom) return custom;
  if (categoryId === "gu-feng-tian-chong") {
    return (
      defaultPro2ScriptCategoryDocBody("gu-feng-tian-chong") ??
      STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT
    );
  }
  return STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT;
}

/** 创意模板 + 解析契约 + shot budget（不含故事正文 · 正文走 textInputs） */
export function buildPro2FullPackUserPrompt(
  baseTemplate: string,
  outlineMd: string,
  scriptCategoryId?: Pro2ScriptCategoryId,
): string {
  const creative = baseTemplate.trim();
  const guFengPack =
    scriptCategoryId === "gu-feng-tian-chong"
      ? PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT.trim()
      : "";
  const base =
    scriptCategoryId === "gu-feng-tian-chong" && guFengPack
      ? guFengPack
      : creative;
  return [base, appendPro2ParseContract({ outlineMd, scriptCategoryId })].join(
    "\n\n",
  );
}

/** 有大纲 → 单次 full-pack outline 段 */
export function isPro2FullPackRun(effectiveOutline: string): boolean {
  return Boolean(effectiveOutline.trim());
}
