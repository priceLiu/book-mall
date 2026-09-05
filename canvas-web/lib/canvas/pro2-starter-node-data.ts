import { STORY_PRO_LLM_PARAMS_DEFAULT } from "./story-pro-prompts";

/** Pro2 文本节点默认 data（spawn / 类别 preset 共用 · 纯函数） */
export function buildPro2StarterNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    starterMode: "generate",
    themeInput: "",
    generatedOutlineMd: "",
    pro2TextPurpose: "general",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    pipelineStage: "idle",
    ...overrides,
  };
}
