import { ecomStoryboardImageEditMaxRefs } from "@/lib/ecom/ecom-storyboard-image-edit";
import type { ModelShotReference } from "@/lib/ecom/ecom-model-shot-types";
import { refByRole } from "@/lib/ecom/ecom-model-shot-types";

/** model-shot 出图参考图顺序：garment → model → scene → poseRef；超上限时优先保留 garment + model + poseRef */
export function buildModelShotRefImageUrls(opts: {
  references: ModelShotReference[];
  poseRefUrl?: string | null;
  modelKey?: string;
  maxRefs?: number;
}): string[] {
  const garment = refByRole(opts.references, "garment")?.ossUrl?.trim();
  const model = refByRole(opts.references, "model")?.ossUrl?.trim();
  const scene = refByRole(opts.references, "scene")?.ossUrl?.trim();
  const pose = opts.poseRefUrl?.trim();

  const ordered = [garment, model, scene, pose].filter(Boolean) as string[];
  const max =
    opts.maxRefs ??
    (opts.modelKey ? ecomStoryboardImageEditMaxRefs(opts.modelKey) : 5);

  if (ordered.length <= max) return ordered;

  const prioritized = [garment, model, pose, scene].filter(Boolean) as string[];
  return prioritized.slice(0, max);
}
