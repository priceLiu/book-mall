import type { ProductDesign } from "@/lib/ecom/ecom-product-design-types";

/** 同步出图批次结束后不应再保持 generating（无后台任务）。 */
export function resolveProductDesignStatusAfterGenBatch(
  design: Pick<ProductDesign, "mainImages" | "detailPages">,
): "completed" | "main_ready" | "draft" {
  const mainDone =
    design.mainImages.length > 0 &&
    design.mainImages.every((m) => Boolean(m.imageUrl?.trim()));
  const detailDone =
    design.detailPages.length > 0 &&
    design.detailPages.every((d) => Boolean(d.imageUrl?.trim()));
  if (mainDone && detailDone) return "completed";
  if (mainDone) return "main_ready";
  return "draft";
}
