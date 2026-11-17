import type { EcomStylePreset } from "@/lib/ecom-style-preset-types";

/** 与 book-mall `trending-style-selection` 一致：整组套图只选一种爆款风格 */
export function normalizeProductImageSetTrendingStyleIds(ids: string[]): string[] {
  const first = ids.find((id) => id.trim());
  return first ? [first.trim()] : [];
}

export function pickTrendingStyleIdsForCards(
  presetIds: string[],
  cards: Pick<EcomStylePreset, "id">[],
): string[] {
  const primary = normalizeProductImageSetTrendingStyleIds(presetIds)[0];
  if (primary && cards.some((c) => c.id === primary)) return [primary];
  const first = cards[0]?.id;
  return first ? [first] : [];
}