import type { EcomCopyLayoutReferenceImage } from "@/components/copy-layout/ecom-copy-layout-studio-dialog";
import type { DetailPageSuiteReference } from "@/lib/detail-page-suite-types";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { ProductImageSetReference } from "@/lib/product-image-set-types";

/** 详情页套图系 · 左侧「引用的图片」（商品 + 模特，与爆款详情一致） */
export function buildDetailPageSuiteCopyLayoutReferenceImages(
  references: DetailPageSuiteReference[] | undefined,
): EcomCopyLayoutReferenceImage[] {
  return (references ?? [])
    .filter((r) => (r.role === "product" || r.role === "model") && r.ossUrl?.trim())
    .map((r) => ({
      url: r.ossUrl.trim(),
      label: r.label?.trim() || (r.role === "product" ? "商品" : "模特"),
    }));
}

/** AI 商品套图 · 项目商品参考图 */
export function buildProductImageSetCopyLayoutReferenceImages(
  references: ProductImageSetReference[] | undefined,
): EcomCopyLayoutReferenceImage[] {
  return (references ?? [])
    .filter((r) => r.ossUrl?.trim())
    .map((r) => ({
      url: r.ossUrl.trim(),
      label: r.label?.trim() || "商品",
    }));
}

/** 套图小窗 Prompt · @ 引用条 */
export function buildProductImageSetPromptMentionRefs(
  references: ProductImageSetReference[] | undefined,
): EcomPromptImageRef[] {
  return (references ?? [])
    .filter((r) => r.ossUrl?.trim())
    .map((r, i) => ({
      url: r.ossUrl.trim(),
      index: i + 1,
      token: `@商品${i + 1}`,
      label: r.label?.trim() || "商品",
      role: "product",
      kind: "product" as const,
      kindIndex: i + 1,
    }));
}