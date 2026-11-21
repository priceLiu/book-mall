import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { ModelShotPoseItem, ModelShotReference } from "@/lib/model-shot-types";
import { refByRole } from "@/lib/model-shot-types";

import {
  describeModelShotGenRefSlots,
  type ModelShotGenRefRole,
} from "@/lib/model-shot-gen-ref-slots";

const ROLE_TO_KIND: Record<
  ModelShotGenRefRole,
  { kind: EcomPromptImageRef["kind"]; role: string }
> = {
  garment: { kind: "product", role: "garment" },
  model: { kind: "model", role: "model" },
  scene: { kind: "style", role: "scene" },
  poseRef: { kind: "style", role: "pose-ref" },
};

/** 服装模特图 · 姿势 Prompt @ 引用（顺序与出图 refImageUrls 一致） */
export function buildModelShotPromptMentionRefs(
  references: ModelShotReference[],
  item?: Pick<ModelShotPoseItem, "poseRefUrl">,
  modelKey?: string,
): EcomPromptImageRef[] {
  const slots = describeModelShotGenRefSlots({ references, item, modelKey });
  return slots.map((slot, i) => {
    const index = i + 1;
    const meta = ROLE_TO_KIND[slot.role];
    return {
      index,
      token: `@图片${index}`,
      kind: meta.kind,
      kindIndex: index,
      url: slot.url,
      label: slot.label,
      role: meta.role,
    };
  });
}