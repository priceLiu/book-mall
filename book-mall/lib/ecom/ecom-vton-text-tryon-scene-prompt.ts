import type { VtonTextTryonRef } from "@/lib/ecom/ecom-vton/types";

const SCENE_REF_RE = /@场景(\d+)/g;

export function isVtonTextTryonSceneRef(ref: VtonTextTryonRef): boolean {
  if (ref.kind === "scene-text") return true;
  return Boolean(ref.scenePrompt?.trim()) && !ref.ossUrl?.trim();
}

export function vtonTextTryonImageRefs(refs: VtonTextTryonRef[]): VtonTextTryonRef[] {
  return refs.filter((r) => r.ossUrl?.trim() && !isVtonTextTryonSceneRef(r));
}

export function parseMentionedSceneIndices(text: string): number[] {
  const indices = new Set<number>();
  for (const m of text.matchAll(SCENE_REF_RE)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) indices.add(n);
  }
  return [...indices].sort((a, b) => a - b);
}

export function vtonTextTryonSceneRefs(refs: VtonTextTryonRef[]): VtonTextTryonRef[] {
  return refs.filter(isVtonTextTryonSceneRef);
}

/** 生图前将 @场景N 替换为场景库文案（保留编辑区 token） */
export function expandVtonTextTryonPromptSceneTokens(
  prompt: string,
  refs: VtonTextTryonRef[],
): string {
  const scenes = vtonTextTryonSceneRefs(refs);
  if (!scenes.length) return prompt;

  return prompt.replace(SCENE_REF_RE, (full, idxStr: string) => {
    const n = parseInt(idxStr, 10);
    if (!Number.isFinite(n) || n < 1) return full;
    const fragment = scenes[n - 1]?.scenePrompt?.trim();
    return fragment || full;
  });
}
