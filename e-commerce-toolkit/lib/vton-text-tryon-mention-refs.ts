import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { VtonTextTryonRef } from "@/lib/vton-types";
import { isVtonTextTryonSceneRef } from "@/lib/vton-text-tryon-scene-ref";

export function buildVtonTextTryonMentionRefs(
  refs: VtonTextTryonRef[],
): EcomPromptImageRef[] {
  const out: EcomPromptImageRef[] = [];
  let imageIdx = 0;
  let sceneIdx = 0;
  let globalIndex = 0;

  for (const r of refs) {
    if (isVtonTextTryonSceneRef(r)) {
      sceneIdx += 1;
      globalIndex += 1;
      out.push({
        index: globalIndex,
        token: `@场景${sceneIdx}`,
        kind: "style",
        kindIndex: sceneIdx,
        url: "",
        label: r.label?.trim() || r.scenePrompt?.trim().slice(0, 24) || `场景${sceneIdx}`,
        role: "scene-text",
      });
      continue;
    }

    const url = r.ossUrl?.trim();
    if (!url) continue;
    imageIdx += 1;
    globalIndex += 1;
    out.push({
      index: globalIndex,
      token: `@图片${imageIdx}`,
      kind: "product",
      kindIndex: imageIdx,
      url,
      label: r.label || `图片${imageIdx}`,
      role: "text-tryon-ref",
    });
  }
  return out;
}
