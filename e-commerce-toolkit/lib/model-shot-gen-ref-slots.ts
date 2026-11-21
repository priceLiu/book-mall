import type { ModelShotPoseItem, ModelShotReference } from "@/lib/model-shot-types";
import { refByRole } from "@/lib/model-shot-types";

export type ModelShotGenRefRole = "garment" | "model" | "scene" | "poseRef";

const ROLE_LABEL: Record<ModelShotGenRefRole, string> = {
  garment: "服装",
  model: "模特",
  scene: "场景",
  poseRef: "姿势参考",
};

/** 与 book-mall `ecomStoryboardImageEditMaxRefs` 对齐（展示用） */
export function modelShotImageGenMaxRefs(modelKey: string): number {
  const k = modelKey.trim().toLowerCase();
  if (k.includes("qwen-image-edit") || k.includes("qwen-image-3.0")) return 3;
  if (k.startsWith("wan2.7-image") || k.startsWith("wan2.6-image")) return 5;
  return 3;
}

/** 本姿势生图时送入模型的参考图槽位（与 book-mall `describeModelShotRefImageSlots` 一致） */
export function describeModelShotGenRefSlots(opts: {
  references: ModelShotReference[];
  item?: Pick<ModelShotPoseItem, "poseRefUrl">;
  modelKey?: string;
  maxRefs?: number;
}): Array<{ role: ModelShotGenRefRole; url: string; label: string }> {
  const garment = refByRole(opts.references, "garment");
  const model = refByRole(opts.references, "model");
  const scene = refByRole(opts.references, "scene");
  const poseUrl = opts.item?.poseRefUrl?.trim();

  const slots: Array<{ role: ModelShotGenRefRole; url: string; label: string }> = [];

  if (garment?.ossUrl?.trim()) {
    slots.push({ role: "garment", url: garment.ossUrl.trim(), label: ROLE_LABEL.garment });
  }
  if (model?.ossUrl?.trim()) {
    slots.push({ role: "model", url: model.ossUrl.trim(), label: ROLE_LABEL.model });
  } else if (model && (model.name || model.description)) {
    slots.push({
      role: "model",
      url: "",
      label: `${ROLE_LABEL.model}（文字：${model.name ?? model.description?.slice(0, 20) ?? "—"}）`,
    });
  }
  if (scene?.ossUrl?.trim()) {
    slots.push({ role: "scene", url: scene.ossUrl.trim(), label: ROLE_LABEL.scene });
  } else if (scene && scene.source !== "none") {
    slots.push({
      role: "scene",
      url: "",
      label: `${ROLE_LABEL.scene}（文字：${scene.name ?? scene.description?.slice(0, 20) ?? "—"}）`,
    });
  }
  const omitPoseImage = Boolean(model?.ossUrl?.trim());
  if (poseUrl && !omitPoseImage) {
    slots.push({ role: "poseRef", url: poseUrl, label: ROLE_LABEL.poseRef });
  } else if (poseUrl && omitPoseImage) {
    slots.push({
      role: "poseRef",
      url: "",
      label: `${ROLE_LABEL.poseRef}（已有模特图，仅文案/姿势描述，不送图防人脸覆盖）`,
    });
  }

  if (opts.modelKey === undefined && opts.maxRefs === undefined) {
    return slots;
  }
  const max =
    opts.maxRefs ?? (opts.modelKey ? modelShotImageGenMaxRefs(opts.modelKey) : 5);
  return slots.slice(0, max);
}