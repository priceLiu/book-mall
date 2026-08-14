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

/** 上传 label 含「模特」则视为模特参考（仍存 main-style / detail-style） */
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
        url: r.ossUrl,
        label: r.label,
        role: r.role,
      });
    } else {
      styleIdx += 1;
      out.push({
        index: globalIndex,
        token: `@参考图${styleIdx}`,
        kind: "style",
        kindIndex: styleIdx,
        url: r.ossUrl,
        label: r.label,
        role: r.role,
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
      url: r.ossUrl,
      label: r.label,
      role: r.role,
    });
  }

  return out;
}

/** 语义 token + 旧版 @图片N */
export const SEMANTIC_REF_TOKEN_RE =
  /@(?:产品实拍|参考图|模特)(\d+)|@图片(\d+)/g;

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
