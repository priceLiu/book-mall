/**
 * 电商工具箱 · 分镜 / 产品创作生图 · 图像编辑模型能力
 * 与 canvas `canvas-image-edit-models.ts` 对齐，并纳入 qwen-image-3.0-pro 图生图/编辑。
 */
import {
  isQwenImage30ProModel,
  isQwenImageEditModel,
} from "@/lib/gateway/qwen-image-edit-proxy";

export const ECOM_STORYBOARD_IMAGE_EDIT_MODEL_KEYS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "wan2.7-image-pro",
  "qwen-image-3.0-pro",
] as const;

export type EcomStoryboardImageEditModelKey =
  (typeof ECOM_STORYBOARD_IMAGE_EDIT_MODEL_KEYS)[number];

export function isEcomStoryboardImageEditModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    isQwenImageEditModel(k) ||
    k === "wan2.7-image-pro" ||
    isQwenImage30ProModel(k)
  );
}

/** 须至少 1 张参考图才可调用（千问专用编辑） */
export function ecomStoryboardImageEditRequiresRefs(modelKey: string): boolean {
  return isQwenImageEditModel(modelKey.trim().toLowerCase());
}

/** 送入模型的参考图总上限 */
export function ecomStoryboardImageEditMaxRefs(modelKey: string): number {
  const k = modelKey.trim().toLowerCase();
  if (isQwenImageEditModel(k) || isQwenImage30ProModel(k)) return 3;
  if (k === "wan2.7-image-pro") return 5;
  return 3;
}

export function assertEcomStoryboardImageEditRefs(
  modelKey: string,
  refCount: number,
): void {
  if (!ecomStoryboardImageEditRequiresRefs(modelKey)) return;
  if (refCount >= 1) return;
  throw new Error(
    "该模型为图像编辑，须至少 1 张参考图（产品图 / 角色 / 场景）后再生成",
  );
}

export function ecomStoryboardImageEditModelLabel(modelKey: string): string {
  const k = modelKey.trim().toLowerCase();
  if (k === "qwen-image-edit") return "千问 · 图像编辑";
  if (k === "qwen-image-edit-max") return "千问 · 图像编辑 Max";
  if (k === "wan2.7-image-pro") return "万相 2.7 Pro · 编辑";
  if (k === "qwen-image-3.0-pro") return "千问 Image 3.0 Pro · 图生图/编辑";
  return modelKey;
}
