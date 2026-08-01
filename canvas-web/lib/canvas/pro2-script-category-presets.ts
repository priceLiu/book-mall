import { STORY_PRO_LLM_PARAMS_DEFAULT } from "./story-pro-prompts";
import {
  STORY_PRO2_PACK_PROMPT_VERSION,
  STORY_PRO2_THEME_OUTLINE_SYSTEM,
  storyPro2GuFengHubPromptPack,
  storyPro2HubDefaultPromptPack,
} from "./story-pro2-theme-outline-prompt";
import { PRO2_GU_FENG_TEXT_SYSTEM } from "./data/pro2-gu-feng-tian-chong-rules";
import {
  defaultPro2ScriptCategoryDocBody,
  defaultPro2ScriptCategoryDocTitle,
  PRO2_GU_FENG_CATEGORY_DOC_TITLE,
} from "./pro2-script-category-doc";
import { PRO2_TEXT_NODE_WIDTH } from "./story-pro2-node-chrome";
import type { CanvasFlowNode } from "./types";

export type Pro2ScriptCategoryId =
  | "gu-feng-tian-chong"
  | "default-master"
  | "custom-prompt";

export type Pro2ScriptCategoryPreset = {
  id: Pro2ScriptCategoryId;
  label: string;
  dockInputDisplay: string;
  starterPatch: Record<string, unknown>;
  hubPatch: Record<string, unknown>;
};

export const PRO2_SCRIPT_CATEGORY_PRESETS: Pro2ScriptCategoryPreset[] = [
  {
    id: "gu-feng-tian-chong",
    label: "古风甜宠短剧剧本",
    dockInputDisplay: PRO2_GU_FENG_CATEGORY_DOC_TITLE,
    starterPatch: {
      label: "故事大纲",
      starterMode: "generate",
      pro2TextPurpose: "story-outline",
      themeOutlineSystemPrompt: PRO2_GU_FENG_TEXT_SYSTEM,
      themeInput: "",
      generatedOutlineMd: "",
    },
    hubPatch: {
      scriptCategoryId: "gu-feng-tian-chong",
      scriptCategoryLabel: "古风甜宠短剧剧本",
      scriptCategoryDocTitle: defaultPro2ScriptCategoryDocTitle("gu-feng-tian-chong"),
      scriptCategoryDocBody: defaultPro2ScriptCategoryDocBody("gu-feng-tian-chong"),
      dockInput: "",
      storyPro2PackPromptVersion: STORY_PRO2_PACK_PROMPT_VERSION,
      ...storyPro2GuFengHubPromptPack(),
    },
  },
  {
    id: "default-master",
    label: "默认剧本大师",
    dockInputDisplay: "",
    starterPatch: {
      label: "故事大纲",
      starterMode: "generate",
      pro2TextPurpose: "story-outline",
      themeOutlineSystemPrompt: STORY_PRO2_THEME_OUTLINE_SYSTEM,
      themeInput: "",
      generatedOutlineMd: "",
    },
    hubPatch: {
      scriptCategoryId: "default-master",
      scriptCategoryLabel: "默认剧本大师",
      scriptCategoryDocTitle: undefined,
      scriptCategoryDocBody: undefined,
      dockInput: "",
      storyPro2PackPromptVersion: STORY_PRO2_PACK_PROMPT_VERSION,
      ...storyPro2HubDefaultPromptPack(),
    },
  },
  {
    id: "custom-prompt",
    label: "自己编写提示词",
    dockInputDisplay: "",
    starterPatch: {
      label: "故事大纲",
      starterMode: "generate",
      pro2TextPurpose: "story-outline",
      themeOutlineSystemPrompt: STORY_PRO2_THEME_OUTLINE_SYSTEM,
      themeInput: "",
      generatedOutlineMd: "",
    },
    hubPatch: {
      scriptCategoryId: "custom-prompt",
      scriptCategoryLabel: "自己编写提示词",
      scriptCategoryDocTitle: undefined,
      scriptCategoryDocBody: undefined,
      dockInput: "",
      storyPro2PackPromptVersion: STORY_PRO2_PACK_PROMPT_VERSION,
      ...storyPro2HubDefaultPromptPack(),
    },
  },
];

export function pro2ScriptCategoryPreset(
  id: Pro2ScriptCategoryId,
): Pro2ScriptCategoryPreset | undefined {
  return PRO2_SCRIPT_CATEGORY_PRESETS.find((p) => p.id === id);
}

/** 按 hub 剧本类别选择 LLM 段 prompt pack（未设类别 → 默认 v5 pack） */
export function resolvePro2HubPromptPack(
  hubData: Pick<{ scriptCategoryId?: Pro2ScriptCategoryId }, "scriptCategoryId"> | undefined,
): ReturnType<typeof storyPro2HubDefaultPromptPack> {
  if (hubData?.scriptCategoryId === "gu-feng-tian-chong") {
    return storyPro2GuFengHubPromptPack();
  }
  return storyPro2HubDefaultPromptPack();
}

const SPAWN_GAP = 48;

/** 计算 spawn 位置（单测用） */
export function pro2ScriptCategorySpawnPosition(
  hub: Pick<CanvasFlowNode, "position" | "width">,
  textWidth = PRO2_TEXT_NODE_WIDTH,
  gap = SPAWN_GAP,
): { x: number; y: number } {
  return {
    x: hub.position.x - textWidth - gap,
    y: hub.position.y,
  };
}

/** spawn / 更新类别时补齐 LLM 默认参数（不覆盖已有 engine） */
export function pro2ScriptCategoryStarterDefaults(
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT, ...(existing?.params as object) },
    providerId: existing?.providerId ?? "",
    modelKey: existing?.modelKey ?? "",
  };
}
