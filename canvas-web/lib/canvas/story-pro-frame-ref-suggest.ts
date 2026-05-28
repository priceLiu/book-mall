/**
 * 影视专业版 · 分镜 @ 引用建议（P-A1 / P-A5）
 */

import { storyRefMentionToken } from "@/lib/canvas/story-ref-image";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";

export type FrameRefSuggestion = {
  characterKey: string;
  name: string;
  refs: StoryRefImage[];
};

type CharacterRowLike = { key: string; name: string };

type FrameRowLike = {
  dialogue?: string;
  description?: string;
  scene?: string;
  prompt?: string;
};

function frameRowSearchText(row: FrameRowLike): string {
  return [row.dialogue, row.description, row.scene, row.prompt]
    .filter(Boolean)
    .join("\n");
}

/** 从对白/描述中匹配出场角色（长名优先，避免短名误匹配） */
export function matchCharactersInFrameText(
  text: string,
  characterRows: CharacterRowLike[],
): CharacterRowLike[] {
  const t = text.trim();
  if (!t) return [];
  const sorted = [...characterRows].sort(
    (a, b) => b.name.length - a.name.length,
  );
  const hit: CharacterRowLike[] = [];
  for (const c of sorted) {
    const name = c.name.trim();
    if (name.length < 2) continue;
    if (t.includes(name)) hit.push(c);
  }
  return hit;
}

export function suggestFrameRefsForRow(
  row: FrameRowLike,
  characterRows: CharacterRowLike[],
  assetRefsByKey: Record<string, StoryRefImage[]>,
): FrameRefSuggestion[] {
  const matched = matchCharactersInFrameText(
    frameRowSearchText(row),
    characterRows,
  );
  const out: FrameRefSuggestion[] = [];
  for (const c of matched) {
    const refs = (assetRefsByKey[c.key] ?? []).filter(
      (r) => r.url && /^https?:\/\//.test(r.url),
    );
    if (refs.length) out.push({ characterKey: c.key, name: c.name, refs });
  }
  return out;
}

export function mergeRefsIntoPrompt(
  currentPrompt: string,
  refs: StoryRefImage[],
): string {
  const existing = new Set<string>();
  const re = /@<([^>\s]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(currentPrompt)) !== null) {
    existing.add(m[1]!);
  }
  const tokens: string[] = [];
  for (const r of refs) {
    if (existing.has(r.id)) continue;
    existing.add(r.id);
    tokens.push(storyRefMentionToken(r.id));
  }
  if (!tokens.length) return currentPrompt;
  const base = currentPrompt.trimEnd();
  return `${base}${base ? " " : ""}${tokens.join(" ")}`.trim();
}

export function collectRefsForSuggestions(
  suggestions: FrameRefSuggestion[],
): StoryRefImage[] {
  const out: StoryRefImage[] = [];
  const seen = new Set<string>();
  for (const s of suggestions) {
    for (const r of s.refs) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

export function applyFrameRefSuggestionsToPrompt(
  currentPrompt: string,
  suggestions: FrameRefSuggestion[],
): { prompt: string; addedRefs: StoryRefImage[] } {
  const refs = collectRefsForSuggestions(suggestions);
  const prompt = mergeRefsIntoPrompt(currentPrompt, refs);
  const addedIds = new Set(
    refs.map((r) => r.id).filter((id) => prompt.includes(storyRefMentionToken(id))),
  );
  return {
    prompt,
    addedRefs: refs.filter((r) => addedIds.has(r.id)),
  };
}
