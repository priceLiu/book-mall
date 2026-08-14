import type { ProductDesignReference } from "@/lib/ecom/ecom-product-design-types";

export type MentionTokenKind = "product" | "style" | "model";

export type SemanticMentionRef = {
  index: number;
  token: string;
  kind: MentionTokenKind;
  kindIndex: number;
  role: ProductDesignReference["role"];
  label: string;
};

export function isModelReferenceLabel(label: string | undefined | null): boolean {
  if (!label?.trim()) return false;
  return /模特|模卡|model/i.test(label);
}

export function buildSemanticMentionRefs(
  references: ProductDesignReference[],
  target: "main" | "detail" = "main",
): SemanticMentionRef[] {
  const styleRole = target === "main" ? "main-style" : "detail-style";
  const style = references.filter((r) => r.role === styleRole);
  const product = references.filter((r) => r.role === "product");

  let modelIdx = 0;
  let styleIdx = 0;
  let productIdx = 0;
  let globalIndex = 0;
  const out: SemanticMentionRef[] = [];

  for (const r of style) {
    globalIndex += 1;
    if (isModelReferenceLabel(r.label)) {
      modelIdx += 1;
      out.push({
        index: globalIndex,
        token: `@模特${modelIdx}`,
        kind: "model",
        kindIndex: modelIdx,
        role: r.role,
        label: r.label,
      });
    } else {
      styleIdx += 1;
      out.push({
        index: globalIndex,
        token: `@参考图${styleIdx}`,
        kind: "style",
        kindIndex: styleIdx,
        role: r.role,
        label: r.label,
      });
    }
  }

  for (const r of product) {
    globalIndex += 1;
    productIdx += 1;
    out.push({
      index: globalIndex,
      token: `@产品实拍${productIdx}`,
      kind: "product",
      kindIndex: productIdx,
      role: r.role,
      label: r.label,
    });
  }

  return out;
}

export function refLegendLines(
  references: ProductDesignReference[],
  target: "main" | "detail",
): string[] {
  const semantic = buildSemanticMentionRefs(references, target);
  return semantic.map((r) => {
    const roleDesc =
      r.kind === "product"
        ? "商品实拍（本次要卖的商品本体）"
        : r.kind === "model"
          ? "模特气质参考（只学姿态/气质，其中的商品不是本次要卖的）"
          : target === "main"
            ? "主图风格/排版参考（只学风格，其中的商品不是本次要卖的）"
            : "详情页风格/排版参考（只学风格，其中的商品不是本次要卖的）";
    return `- ${r.token}（参考图第 ${r.index} 张）：${roleDesc}`;
  });
}
