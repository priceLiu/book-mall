import {
  isStoryboardKieImageModel,
  isStoryboardKlingImageModel,
  isWan26ImageModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import {
  ecomStoryboardImageEditMaxRefs,
  isEcomStoryboardImageEditModel,
} from "@/lib/ecom/ecom-storyboard-image-edit";
import { isStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import {
  filterProductDesignReferencesByRole,
  type ProductDesignReference,
  type ProductDesignReferenceRole,
} from "@/lib/ecom/ecom-product-design-types";

/** 风格参考张数上限（与视觉/生图 API 上限解耦；出图时按模型截断） */
export const PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX = 9;
export const PRODUCT_DESIGN_MODEL_REF_UPLOAD_MAX = 9;
export const PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX = 3;

export {
  getProductDesignRefUploadMaxBytes,
  PRODUCT_DESIGN_REF_STORE_MAX_BYTES,
  PRODUCT_DESIGN_REF_UPLOAD_MAX_BYTES_DEFAULT,
  PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX_BYTES,
} from "./ecom-product-design-ref-upload-normalize";

export function getVisionMaxInputImages(modelKey: string): number {
  const key = modelKey.trim();
  if (key.includes("vl") || key.startsWith("qwen3-vl")) return 8;
  if (isStoryLlmVisionModel(key)) return 6;
  return 4;
}

/** IMAGE 生图模型参考图上限（含产品实拍） */
export function getImageGenMaxRefs(modelKey: string): number {
  const key = modelKey.trim();
  if (isEcomStoryboardImageEditModel(key)) {
    return ecomStoryboardImageEditMaxRefs(key);
  }
  if (isStoryboardKieImageModel(key)) return 8;
  if (isStoryboardKlingImageModel(key)) return 10;
  if (isWan26ImageModel(key)) return 5;
  if (key.includes("wan2.7") || key.includes("wan2.6")) return 5;
  return 6;
}

const STYLE_ROLE_MAX = PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX;

/** 风格图再多也给商品实拍留出的位置，避免商品本体被截断掉 */
const PRODUCT_REF_RESERVED_SLOTS = 2;

/**
 * 参考图送入模型的统一顺序：有风格参考时「风格在前、商品在后」，否则只有商品。
 *
 * 视觉分析、生图下发与前端 @图片N 编号（buildProductDesignPromptMentionRefs）
 * 必须共用这一个顺序。任何一处不一致，用户写的「图片4 是我的商品」都会指到别的图，
 * 模型就会照着风格参考里的商品出图。
 */
export function orderRefsForModel<T>(
  product: T[],
  style: T[],
  max: number,
): { ordered: T[]; styleFirst: boolean; productCount: number; styleCount: number } {
  if (max <= 0) {
    return { ordered: [], styleFirst: false, productCount: 0, styleCount: 0 };
  }
  if (style.length === 0) {
    const ordered = product.slice(0, max);
    return { ordered, styleFirst: false, productCount: ordered.length, styleCount: 0 };
  }
  const productTake =
    product.length > 0 ? Math.min(product.length, PRODUCT_REF_RESERVED_SLOTS) : 0;
  const styleTake = Math.min(style.length, Math.max(0, max - productTake));
  const ordered = [
    ...style.slice(0, styleTake),
    ...product.slice(0, Math.max(0, max - styleTake)),
  ].slice(0, max);
  return {
    ordered,
    styleFirst: true,
    styleCount: styleTake,
    productCount: ordered.length - styleTake,
  };
}

/** 风格 + 模特参考（送入模型时与 product 一起排序） */
export function productDesignStyleLikeReferences(
  references: ProductDesignReference[],
  target: "main" | "detail",
): ProductDesignReference[] {
  const styleRole = target === "main" ? "main-style" : "detail-style";
  return [
    ...filterProductDesignReferencesByRole(references, [styleRole]),
    ...filterProductDesignReferencesByRole(references, ["model"]),
  ];
}

/**
 * 详情屏出图：用当前屏切片替代整页 detail-style，保留模特等其它风格参考。
 */
export function refUrlsForDetailScreen(
  references: ProductDesignReference[],
  modelKey: string,
  styleSliceUrl?: string,
): {
  urls: string[];
  productCount: number;
  styleCount: number;
  styleFirst: boolean;
} {
  const product = filterProductDesignReferencesByRole(references, ["product"]).map(
    (r) => r.ossUrl,
  );
  const models = filterProductDesignReferencesByRole(references, ["model"]).map(
    (r) => r.ossUrl,
  );
  const styleUrls = styleSliceUrl
    ? [styleSliceUrl, ...models]
    : productDesignStyleLikeReferences(references, "detail").map((r) => r.ossUrl);
  const packed = orderRefsForModel(product, styleUrls, getImageGenMaxRefs(modelKey));
  return {
    urls: packed.ordered,
    productCount: packed.productCount,
    styleCount: packed.styleCount,
    styleFirst: packed.styleFirst,
  };
}

export function referencesForDetailScreenLegend(
  references: ProductDesignReference[],
  screenIndex: number,
  styleSliceUrl?: string,
): ProductDesignReference[] {
  if (!styleSliceUrl?.trim()) return references;
  let replacedDetailStyle = false;
  return references.flatMap((r) => {
    if (r.role === "detail-style") {
      if (replacedDetailStyle) return [];
      replacedDetailStyle = true;
      return [
        {
          ...r,
          ossUrl: styleSliceUrl,
          label: `${r.label}（第 ${screenIndex} 屏切片）`,
        },
      ];
    }
    return [r];
  });
}

export function getMaxRefsForRole(
  role: ProductDesignReferenceRole,
  opts?: { visionModelKey?: string; imageModelKey?: string },
): number {
  if (role === "product") return PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX;
  if (role === "main-style" || role === "detail-style") {
    return STYLE_ROLE_MAX;
  }
  if (role === "model") return PRODUCT_DESIGN_MODEL_REF_UPLOAD_MAX;
  return 6;
}

/** 视觉分析 / 生图时实际送入模型的参考图上限 */
export function getMaxRefsForRoleAtInvoke(
  role: ProductDesignReferenceRole,
  opts?: { visionModelKey?: string; imageModelKey?: string },
): number {
  if (role === "product") return PRODUCT_DESIGN_PRODUCT_REF_UPLOAD_MAX;
  if (role === "main-style" || role === "detail-style" || role === "model") {
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
