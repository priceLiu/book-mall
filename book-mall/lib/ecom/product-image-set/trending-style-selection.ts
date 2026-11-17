/** 爆款风格：整组套图仅采用一种视觉调性（存储仍为数组，最多 1 个 id） */
export function normalizeSelectedTrendingStyleIds(ids: string[]): string[] {
  const first = ids.find((id) => typeof id === "string" && id.trim());
  return first ? [first.trim()] : [];
}

export function primarySelectedTrendingStyleId(ids: string[]): string | null {
  return normalizeSelectedTrendingStyleIds(ids)[0] ?? null;
}