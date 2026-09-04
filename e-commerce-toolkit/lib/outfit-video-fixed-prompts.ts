import {
  OUTFIT_V1_GENERATE_BASE_PROMPT_ZH,
  OUTFIT_V1_LLM_JSON_PREFIX,
  OUTFIT_V1_NEGATIVE_PROMPT_ZH,
} from "@/lib/video-workflow/templates/outfit-v1/constants";
import {
  getOutfitSplitEnrichPromptUi,
  outfitSplitUserPromptPreview,
} from "@/lib/outfit-video-split-prompts";

/** 折叠摘要：拆镜 User 指令首句 */
export const OUTFIT_SPLIT_PROMPT_COLLAPSED_PREVIEW = outfitSplitUserPromptPreview(120);

/** 拆解 enrich + 逐镜生成 Prompt 分区（只读 + 生成区引用） */
export function getOutfitFixedPromptSections() {
  return {
    split: getOutfitSplitEnrichPromptUi(),
    generate: {
      basePositive: OUTFIT_V1_GENERATE_BASE_PROMPT_ZH,
      negative: OUTFIT_V1_NEGATIVE_PROMPT_ZH,
      jsonPrefix: OUTFIT_V1_LLM_JSON_PREFIX,
    },
  };
}

export {
  OUTFIT_V1_GENERATE_BASE_PROMPT_ZH,
  OUTFIT_V1_LLM_JSON_PREFIX,
  OUTFIT_V1_NEGATIVE_PROMPT_ZH,
};
