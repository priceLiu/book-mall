import {
  isStoryboardKieImageModel,
  isStoryboardKlingImageModel,
  isWan26ImageModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import { isStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import type { ProductDesignReferenceRole } from "@/lib/ecom/ecom-product-design-types";

/** 风格参考上传上限（与视觉/生图 API 上限解耦；出图时按模型截断） */
export const PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX = 9;
export const PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX = 3;

export function getVisionMaxInputImages(modelKey: string): number {
  const key = modelKey.trim();
  if (key.includes("vl") || key.startsWith("qwen3-vl")) return 8;
  if (isStoryLlmVisionModel(key)) return 6;
  return 4;
}

/** IMAGE 生图模型参考图上限（含产品实拍） */
export function getImageGenMaxRefs(modelKey: string): number {
  const key = modelKey.trim();
  if (isStoryboardKieImageModel(key)) return 8;
  if (isStoryboardKlingImageModel(key)) return 10;
  if (isWan26ImageModel(key)) return 5;
  if (key.includes("wan2.7") || key.includes("wan2.6")) return 5;
  return 6;
}

const STYLE_ROLE_MAX = PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX;

export function getMaxRefsForRole(
  role: ProductDesignReferenceRole,
  opts?: { visionModelKey?: string; imageModelKey?: string },
): number {
  if (role === "product") return PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX;
  if (role === "main-style" || role === "detail-style") {
    return STYLE_ROLE_MAX;
  }
  return 6;
}

/** 视觉分析 / 生图时实际送入模型的参考图上限 */
export function getMaxRefsForRoleAtInvoke(
  role: ProductDesignReferenceRole,
  opts?: { visionModelKey?: string; imageModelKey?: string },
): number {
  if (role === "product") return PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX;
  if (role === "main-style" || role === "detail-style") {
    const visionMax = opts?.visionModelKey
      ? getVisionMaxInputImages(opts.visionModelKey)
      : STYLE_ROLE_MAX;
    const imageMax = opts?.imageModelKey
      ? getImageGenMaxRefs(opts.imageModelKey)
      : STYLE_ROLE_MAX;
    return Math.min(STYLE_ROLE_MAX, visionMax, imageMax);
  }
  return 6;
}

export function assertProductDesignRefUploadAllowed(opts: {
  role: ProductDesignReferenceRole;
  existingCountForRole: number;
  visionModelKey?: string;
  imageModelKey?: string;
}): void {
  const max = getMaxRefsForRole(opts.role, {
    visionModelKey: opts.visionModelKey,
    imageModelKey: opts.imageModelKey,
  });
  if (opts.existingCountForRole >= max) {
    throw new Error(`该类型参考图已达上限（最多 ${max} 张）`);
  }
}
