/**
 * 画布 · Gateway 图像编辑模型（平台代付 · DashScope）
 */
import { isQwenImageEditModel } from "@/lib/gateway/qwen-image-edit-proxy";

export const CANVAS_IMAGE_EDIT_MODEL_KEYS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "wan2.7-image-pro",
] as const;

export type CanvasImageEditModelKey = (typeof CANVAS_IMAGE_EDIT_MODEL_KEYS)[number];

export function isCanvasImageEditModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    isQwenImageEditModel(k) ||
    k === "wan2.7-image-pro"
  );
}

/** 图像编辑场景须至少一张参考图（上游连线 / 本节点 / 风格参考） */
export function canvasImageEditRequiresRefs(
  modelKey: string,
  opts?: { imageMode?: string | null },
): boolean {
  const k = modelKey.trim().toLowerCase();
  if (isQwenImageEditModel(k)) return true;
  if (k === "wan2.7-image-pro") {
    return opts?.imageMode === "img2img";
  }
  return false;
}

export function canvasImageEditModelLabel(modelKey: string): string {
  const k = modelKey.trim().toLowerCase();
  if (k === "qwen-image-edit") return "千问 · 图像编辑";
  if (k === "qwen-image-edit-max") return "千问 · 图像编辑 Max";
  if (k === "wan2.7-image-pro") return "万相 2.7 Pro · 编辑";
  return modelKey;
}
