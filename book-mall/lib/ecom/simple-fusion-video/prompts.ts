import { buildSimpleFusionAutoPrompts } from "./auto-prompts";
import { SIMPLE_FUSION_PROMPT_BODIES, type SimpleFusionVariant } from "./constants";
import { buildSimpleFusionFusionPrompt, simpleFusionFusionNegativePrompt } from "./fusion-prompts";
import type { SimpleFusionPrompts, SimpleFusionReferences } from "./types";

export function resolveSimpleFusionPrompts(
  variant: SimpleFusionVariant,
  user: SimpleFusionPrompts | null | undefined,
  references: SimpleFusionReferences,
  promptsCustomized?: boolean,
): { fusion: string; video: string; negative: string } {
  if (promptsCustomized === true) {
    const bodies = SIMPLE_FUSION_PROMPT_BODIES[variant];
    const auto = buildSimpleFusionAutoPrompts(variant, references);
    return {
      fusion: user?.fusion?.trim() || auto.fusion,
      video: user?.video?.trim() || auto.video,
      negative: user?.negative?.trim() || simpleFusionFusionNegativePrompt(variant),
    };
  }
  return buildSimpleFusionAutoPrompts(variant, references);
}

/** 每套服装融合时单独 Prompt（自动模式按 @服装N 分段；自定义模式共用用户 fusion 文案） */
export function resolveSimpleFusionFusionPromptForLook(
  variant: SimpleFusionVariant,
  references: SimpleFusionReferences,
  garmentIndex: number,
  user: SimpleFusionPrompts | null | undefined,
  promptsCustomized?: boolean,
): string {
  if (promptsCustomized === true) {
    const fallback = buildSimpleFusionFusionPrompt(variant, references, garmentIndex);
    return user?.fusion?.trim() || fallback;
  }
  return buildSimpleFusionFusionPrompt(variant, references, garmentIndex);
}
