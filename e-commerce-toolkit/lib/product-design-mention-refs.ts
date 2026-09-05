import type { ProductDesignProject } from "@/lib/product-design-types";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import {
  buildSemanticMentionRefs,
  type MentionTokenKind,
} from "@/lib/product-design-mention-tokens";

export type { MentionTokenKind };

/** @ 引用：风格/模特在前，产品实拍在后；token 按角色分别编号 */
export function buildProductDesignPromptMentionRefs(
  project: ProductDesignProject,
  target: "main" | "detail" = "main",
): EcomPromptImageRef[] {
  return buildSemanticMentionRefs(project.references, target).map((r) => ({
    index: r.index,
    token: r.token,
    kind: r.kind,
    kindIndex: r.kindIndex,
    url: r.url,
    label: r.label,
    role: r.role,
  }));
}

export function mentionRefRoleLabel(role: string, kind?: MentionTokenKind): string {
  if (kind === "model") return "模特";
  if (kind === "product") return "产品实拍";
  if (kind === "style") return "参考图";
  if (role === "product") return "产品实拍";
  if (role === "main-style") return "主图风格";
  if (role === "detail-style") return "详情风格";
  return "参考图";
}
