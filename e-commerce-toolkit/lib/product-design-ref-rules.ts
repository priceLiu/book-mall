/** 与 book-mall/lib/ecom/ecom-product-design-ref-rules.ts 保持一致（前端展示用） */

export type ProductDesignRefRole =
  | "product"
  | "main-style"
  | "detail-style"
  | "scene"
  | "model"
  | "other";

/** 风格参考上传上限（出图/分析时按模型能力截断） */
export const PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX = 9;
export const PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX = 3;

export function getVisionMaxInputImagesClient(modelKey: string): number {
  const key = modelKey.trim();
  if (key.includes("vl") || key.startsWith("qwen3-vl")) return 8;
  if (
    /qwen3\.(5|6|7)-plus|doubao-seed|gemini|gpt-5/i.test(key)
  ) {
    return 6;
  }
  return 4;
}

export function getImageGenMaxRefsClient(modelKey: string): number {
  const key = modelKey.trim();
  if (/seedream|nano-banana|flux|kie/i.test(key)) return 8;
  if (/kling/i.test(key)) return 10;
  if (/wan2\.[67]|wanx/i.test(key)) return 5;
  return 6;
}

/** 上传区展示的上限（用户可传满；分析/出图时再截断） */
export function getMaxRefsForRoleClient(
  role: ProductDesignRefRole,
  _opts?: { visionModelKey?: string; imageModelKey?: string },
): number {
  if (role === "product") return PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX;
  if (role === "main-style" || role === "detail-style") {
    return PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX;
  }
  return 6;
}

/** 单次视觉分析 / 生图送入模型的参考图上限 */
export function getMaxRefsForRoleAtInvokeClient(
  role: ProductDesignRefRole,
  opts?: { visionModelKey?: string; imageModelKey?: string },
): number {
  if (role === "product") return PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX;
  if (role === "main-style" || role === "detail-style") {
    const visionMax = opts?.visionModelKey
      ? getVisionMaxInputImagesClient(opts.visionModelKey)
      : PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX;
    const imageMax = opts?.imageModelKey
      ? getImageGenMaxRefsClient(opts.imageModelKey)
      : PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX;
    return Math.min(PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX, visionMax, imageMax);
  }
  return 6;
}

export function hasProductRef(
  references: Array<{ role: string }>,
): boolean {
  return references.some((r) => r.role === "product");
}
