import {
  SIMPLE_FUSION_PROMPT_BODIES,
  type SimpleFusionVariant,
} from "@/lib/simple-fusion-default-prompts";

import {
  simpleFusionSlotFusionSuccess,
  type SimpleFusionPreviewSlot,
} from "@/lib/simple-fusion-preview-slots";

/** 图生视频 Prompt：自动 @ 已成功融合图（失败/未出图的不引用） */
export function buildSimpleFusionAutoVideoPrompt(
  variant: SimpleFusionVariant,
  slots: SimpleFusionPreviewSlot[],
): string {
  const body = SIMPLE_FUSION_PROMPT_BODIES[variant].video;
  const success = slots.filter(simpleFusionSlotFusionSuccess);
  if (success.length === 0) {
    return body;
  }
  const tokens = success.map((_, i) => `@融合${i + 1}`).join(" ");
  return `${tokens}，${body}`;
}
