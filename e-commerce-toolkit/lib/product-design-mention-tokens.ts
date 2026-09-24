import type { ProductDesignReference } from "@/lib/product-design-types";

export type MentionTokenKind = "product" | "style" | "model";

export type SemanticMentionRef = {
  /** 全局序号（兼容旧 @图片N） */
  index: number;
  /** 语义 token，如 @产品实拍1 */
  token: string;
  kind: MentionTokenKind;
  /** 同类目内序号（1 起） */
  kindIndex: number;
  url: string;
  label: string;
  role: string;
};

/** 上传 label 含「模特」则视为模特参考（仍存 main-style / detail-style 时兼容） */
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
      url: r.ossUrl,
      label: r.label,
      role: r.role,
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
      url: r.ossUrl,
      label: r.label,
      role: r.role,
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
      url: r.ossUrl,
      label: r.label,
      role: r.role,
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
      url: r.ossUrl,
      label: r.label,
      role: r.role,
    });
  }

  return out;
}

/** 语义 token + 旧版 @图片N + 换背景框选主体 */
export const SEMANTIC_REF_TOKEN_RE =
  /@(?:人物[A-F\d]+|产品\d+|道具\d+|场景\d+|产品实拍\d+|详情页参考\d+|参考图\d+|模特\d+|图[12]框选|图片\d+)/g;

export function mentionTokenDisplay(token: string): string {
  return token.startsWith("@") ? token.slice(1) : token;
}

export function findMentionRefByToken(
  refs: SemanticMentionRef[],
  token: string,
): SemanticMentionRef | undefined {
  const normalized = token.startsWith("@") ? token : `@${token}`;
  return refs.find((r) => r.token === normalized);
}

export function findMentionRefByLegacyIndex(
  refs: SemanticMentionRef[],
  legacyIndex: number,
): SemanticMentionRef | undefined {
  return refs.find((r) => r.index === legacyIndex);
}
