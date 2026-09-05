/** 搜索框下方默认展示的选项数（未输入关键词时） */
export const DIMENSION_SEARCH_DEFAULT_VISIBLE = 5;

export function filterDimensionOptions(
  options: readonly string[],
  query: string,
  defaultVisibleCount: number = DIMENSION_SEARCH_DEFAULT_VISIBLE,
): string[] {
  const q = query.trim().toLowerCase();
  const matched = !q
    ? [...options]
    : options.filter((opt) => opt.toLowerCase().includes(q));
  if (!q && defaultVisibleCount > 0 && matched.length > defaultVisibleCount) {
    return matched.slice(0, defaultVisibleCount);
  }
  return matched;
}

export function dimensionOptionsHasMore(
  options: readonly string[],
  query: string,
  defaultVisibleCount: number = DIMENSION_SEARCH_DEFAULT_VISIBLE,
): boolean {
  const q = query.trim();
  if (q) return false;
  return options.length > defaultVisibleCount;
}
