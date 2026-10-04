import { SIMPLE_FUSION_PROMPT_BODIES, type SimpleFusionVariant } from "./constants";
import {
  buildSimpleFusionFusionPrompt,
  simpleFusionFusionNegativePrompt,
} from "./fusion-prompts";
import type { SimpleFusionReferences } from "./types";

function countGarments(references: SimpleFusionReferences): number {
  return (references.garments ?? []).filter((g) => g.ossUrl?.trim()).length;
}

export function buildSimpleFusionAutoPrompts(
  variant: SimpleFusionVariant,
  references: SimpleFusionReferences,
  opts?: { fusionGarmentIndex?: number },
): { fusion: string; video: string; negative: string } {
  const bodies = SIMPLE_FUSION_PROMPT_BODIES[variant];
  const garmentCount = countGarments(references);
  const fusionGarmentIndex = opts?.fusionGarmentIndex ?? (garmentCount > 0 ? 1 : 1);

  return {
    fusion: buildSimpleFusionFusionPrompt(variant, references, fusionGarmentIndex),
    /** 图生视频仅传入融合图，Prompt 只描述动作/运镜，不再 @ 模特/服装/场景 */
    video: bodies.video,
    negative: simpleFusionFusionNegativePrompt(variant),
  };
}
