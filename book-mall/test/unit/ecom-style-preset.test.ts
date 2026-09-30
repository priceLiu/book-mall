import { describe, expect, it } from "vitest";

import {
  getStylePresetByIdFromSeed,
  listStylePresetsFromSeed,
  suggestTrendingStylePresetsFromSeed,
} from "@/lib/ecom/ecom-style-preset";

describe("ecom-style-preset catalog", () => {
  it("sellpoint layouts come from DB, not legacy seed", () => {
    const items = listStylePresetsFromSeed({ kind: "sellpoint_layout", vertical: "generic" });
    expect(items.length).toBe(0);
  });

  it("resolves trending preset by id from seed", () => {
    const p = getStylePresetByIdFromSeed("tv-3c-esports");
    expect(p?.kind).toBe("trending_visual");
  });

  it("suggest trending returns up to 4 for 3c", () => {
    const items = suggestTrendingStylePresetsFromSeed({
      vertical: "digital_3c",
      limit: 4,
      seed: "test",
    });
    expect(items.length).toBe(4);
    expect(items.every((x) => x.kind === "trending_visual")).toBe(true);
  });
});
