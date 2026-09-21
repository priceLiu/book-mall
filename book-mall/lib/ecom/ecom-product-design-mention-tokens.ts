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

/** 上传 label 含「模特」则视为模特气质参考（仍存 main-style / detail-style 时兼容） */
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
  const models = references.filter((r) => r.role === "model");
  const product = references.filter((r) => r.role === "product");

  let refFigIdx = 0;
  let styleKindIdx = 0;
  let modelKindIdx = 0;
  let productIdx = 0;
  let globalIndex = 0;
  const out: SemanticMentionRef[] = [];

  const pushRefFigure = (
    r: ProductDesignReference,
    kind: MentionTokenKind,
    kindIndex: number,
  ) => {
    globalIndex += 1;
    refFigIdx += 1;
    out.push({
      index: globalIndex,
      token: `@参考图${refFigIdx}`,
      kind,
      kindIndex,
      role: r.role,
      label: r.label,
    });
  };

  const pushModelRef = (r: ProductDesignReference, kindIndex: number) => {
    globalIndex += 1;
    refFigIdx += 1;
    out.push({
      index: globalIndex,
      token: `@模特${kindIndex}`,
      kind: "model",
      kindIndex,
      role: r.role,
      label: r.label,
    });
  };

  const pushDetailStyleRef = (r: ProductDesignReference, kindIndex: number) => {
    globalIndex += 1;
    refFigIdx += 1;
    out.push({
      index: globalIndex,
      token: `@详情页参考${kindIndex}`,
      kind: "style",
      kindIndex,
      role: r.role,
      label: r.label,
    });
  };

  for (const r of style) {
    if (isModelReferenceLabel(r.label)) {
      modelKindIdx += 1;
      pushModelRef(r, modelKindIdx);
    } else {
      styleKindIdx += 1;
      if (target === "detail") {
        pushDetailStyleRef(r, styleKindIdx);
      } else {
        pushRefFigure(r, "style", styleKindIdx);
      }
    }
  }

  for (const r of models) {
    modelKindIdx += 1;
    pushModelRef(r, modelKindIdx);
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
