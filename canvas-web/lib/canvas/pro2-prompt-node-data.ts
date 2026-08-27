import { STORY_PRO_LLM_PARAMS_DEFAULT } from "./story-pro-prompts";

/** Pro2 提示词节点默认 data */
export function buildPro2PromptNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    prompt: "",
    generatedText: "",
    pro2TextPurpose: "general",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    dockRefImages: [],
    ...overrides,
  };
}
