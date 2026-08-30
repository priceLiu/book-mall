export function filterDimensionOptions(options: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter((opt) => opt.toLowerCase().includes(q));
}
