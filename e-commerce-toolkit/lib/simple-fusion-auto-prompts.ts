import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";
import {
  buildSimpleFusionFusionPrompt,
  simpleFusionFusionNegativePrompt,
} from "@/lib/simple-fusion-fusion-prompts";
import {
  SIMPLE_FUSION_PROMPT_BODIES,
  type SimpleFusionVariant,
} from "@/lib/simple-fusion-default-prompts";

function countGarments(references: SimpleFusionProject["references"]): number {
  return (references.garments ?? []).filter((g) => g.ossUrl?.trim()).length;
}

/** 融合：分段 + 句内 @（对齐模特试衣）；多套时编辑区展示 @服装1 模板，生成按套切换 @服装N */
export function buildSimpleFusionAutoPrompts(
  variant: SimpleFusionVariant,
  references: SimpleFusionProject["references"],
  opts?: { fusionGarmentIndex?: number },
): { fusion: string; video: string; negative: string } {
  const bodies = SIMPLE_FUSION_PROMPT_BODIES[variant];
  const garmentCount = countGarments(references);
  const fusionGarmentIndex = opts?.fusionGarmentIndex ?? (garmentCount > 0 ? 1 : 1);

  return {
    fusion: buildSimpleFusionFusionPrompt(variant, references, fusionGarmentIndex),
    video: bodies.video,
    negative: simpleFusionFusionNegativePrompt(variant),
  };
}

export function simpleFusionPromptsEqual(
  a: { fusion: string; video: string; negative: string },
  b: { fusion: string; video: string; negative: string },
): boolean {
  return (
    a.fusion.trim() === b.fusion.trim() &&
    a.video.trim() === b.video.trim() &&
    a.negative.trim() === b.negative.trim()
  );
}
