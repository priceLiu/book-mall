import { ecomStoryboardImageEditMaxRefs } from "@/lib/ecom/ecom-storyboard-image-edit";
import type { ModelShotReference } from "@/lib/ecom/ecom-model-shot-types";
import { refByRole } from "@/lib/ecom/ecom-model-shot-types";

/** 已指定模特参考图时，姿势库预览常含他人全身照，送入多模态会覆盖人脸 */
export function shouldOmitModelShotPoseRefImage(
  references: ModelShotReference[],
): boolean {
  return Boolean(refByRole(references, "model")?.ossUrl?.trim());
}

/**
 * model-shot 出图参考顺序：garment → model → scene → poseRef。
 * 超上限时按同样优先级截断（先丢姿势库预览图，保留服装/模特/场景一致性）。
 * 有模特参考图 ossUrl 时不送 poseRef 图像（姿势仍由 Prompt / poseDescription 约束）。
 */
export function buildModelShotRefImageUrls(opts: {
  references: ModelShotReference[];
  poseRefUrl?: string | null;
  modelKey?: string;
  maxRefs?: number;
}): string[] {
  const garment = refByRole(opts.references, "garment")?.ossUrl?.trim();
  const model = refByRole(opts.references, "model")?.ossUrl?.trim();
  const scene = refByRole(opts.references, "scene")?.ossUrl?.trim();
  const omitPoseImage = shouldOmitModelShotPoseRefImage(opts.references);
  const pose = !omitPoseImage ? opts.poseRefUrl?.trim() : undefined;

  const max =
    opts.maxRefs ??
    (opts.modelKey ? ecomStoryboardImageEditMaxRefs(opts.modelKey) : 5);

  const priority = [garment, model, scene, pose].filter(Boolean) as string[];
  return priority.slice(0, max);
}

export type ModelShotRefImageRole = "garment" | "model" | "scene" | "poseRef";

/** 调试用：与本批次实际送入 Gateway 的 URL 列表对齐 */
export function describeModelShotRefImageSlots(opts: {
  references: ModelShotReference[];
  poseRefUrl?: string | null;
  modelKey?: string;
  maxRefs?: number;
}): Array<{ role: ModelShotRefImageRole; url: string }> {
  const garment = refByRole(opts.references, "garment")?.ossUrl?.trim();
  const model = refByRole(opts.references, "model")?.ossUrl?.trim();
  const scene = refByRole(opts.references, "scene")?.ossUrl?.trim();
  const omitPoseImage = shouldOmitModelShotPoseRefImage(opts.references);
  const pose = !omitPoseImage ? opts.poseRefUrl?.trim() : undefined;

  const slots: Array<{ role: ModelShotRefImageRole; url: string }> = [];
  if (garment) slots.push({ role: "garment", url: garment });
  if (model) slots.push({ role: "model", url: model });
  if (scene) slots.push({ role: "scene", url: scene });
  if (pose) slots.push({ role: "poseRef", url: pose });

  const max =
    opts.maxRefs ??
    (opts.modelKey ? ecomStoryboardImageEditMaxRefs(opts.modelKey) : 5);

  return slots.slice(0, max);
}