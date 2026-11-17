import { describe, expect, it } from "vitest";

import {
  normalizeSelectedTrendingStyleIds,
  primarySelectedTrendingStyleId,
} from "@/lib/ecom/product-image-set/trending-style-selection";

describe("product-image-set trending style selection", () => {
  it("keeps only the first id", () => {
    expect(normalizeSelectedTrendingStyleIds(["a", "b"])).toEqual(["a"]);
    expect(primarySelectedTrendingStyleId(["a", "b"])).toBe("a");
  });

  it("returns empty when no ids", () => {
    expect(normalizeSelectedTrendingStyleIds([])).toEqual([]);
    expect(primarySelectedTrendingStyleId(["", "  "])).toBeNull();
  });
});