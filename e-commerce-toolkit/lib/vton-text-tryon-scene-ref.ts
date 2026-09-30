import type { VtonTextTryonRef } from "@/lib/vton-types";

export function isVtonTextTryonSceneRef(ref: VtonTextTryonRef): boolean {
  if (ref.kind === "scene-text") return true;
  return Boolean(ref.scenePrompt?.trim()) && !ref.ossUrl?.trim();
}

export function vtonTextTryonImageRefs(refs: VtonTextTryonRef[]): VtonTextTryonRef[] {
  return refs.filter((r) => r.ossUrl?.trim() && !isVtonTextTryonSceneRef(r));
}

export function vtonTextTryonSceneRefs(refs: VtonTextTryonRef[]): VtonTextTryonRef[] {
  return refs.filter(isVtonTextTryonSceneRef);
}

/** 选中场景库后追加 @场景N（已有则跳过） */
export function appendVtonTextTryonSceneToken(prompt: string, sceneIndex: number): string {
  const token = `@场景${sceneIndex}`;
  const trimmed = prompt.trim();
  if (!trimmed) return token;
  if (trimmed.includes(token)) return trimmed;
  return `${trimmed}\n${token}`;
}
