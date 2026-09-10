import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { VtonTextTryonRef } from "@/lib/vton-types";

export function buildVtonTextTryonMentionRefs(
  refs: VtonTextTryonRef[],
): EcomPromptImageRef[] {
  const out: EcomPromptImageRef[] = [];
  refs.forEach((r, i) => {
    const url = r.ossUrl?.trim();
    if (!url) return;
    const index = i + 1;
    out.push({
      index,
      token: `@图片${index}`,
      kind: "product",
      kindIndex: index,
      url,
      label: r.label || `图片${index}`,
      role: "text-tryon-ref",
    });
  });
  return out;
}
