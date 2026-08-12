import type { ProductDesignProject } from "@/lib/product-design-types";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";

/** @ 引用顺序：风格参考在前，产品实拍在后（与模板 @图片1… 一致） */
export function buildProductDesignPromptMentionRefs(
  project: ProductDesignProject,
  target: "main" | "detail" = "main",
): EcomPromptImageRef[] {
  const styleRole = target === "main" ? "main-style" : "detail-style";
  const style = project.references.filter((r) => r.role === styleRole);
  const product = project.references.filter((r) => r.role === "product");
  return [...style, ...product].map((r, i) => ({
    index: i + 1,
    url: r.ossUrl,
    label: r.label,
    role: r.role,
  }));
}

export function mentionRefRoleLabel(role: string): string {
  if (role === "product") return "产品实拍";
  if (role === "main-style") return "主图风格";
  if (role === "detail-style") return "详情风格";
  return "参考图";
}
