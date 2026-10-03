import { describe, expect, it } from "vitest";

import { resolvePosterGenerationRefUrls } from "@/lib/ecom/ecom-poster-ref-resolve";
import type { PosterPlan, PosterReference } from "@/lib/ecom/ecom-poster-types";

const refs: PosterReference[] = [
  { id: "1", role: "garment", ossUrl: "https://cdn.example/g.jpg" },
  { id: "2", role: "model", ossUrl: "https://cdn.example/m.jpg" },
  { id: "3", role: "brand", ossUrl: "https://cdn.example/b.jpg" },
];

function plan(partial: Partial<PosterPlan>): PosterPlan {
  return {
    tier: "easy",
    easyPath: "C",
    posterStyleId: "ecom-bright",
    aspectRatio: "3:4",
    burnCopyInImage: false,
    useBrandRefs: false,
    artifacts: [],
    ...partial,
  };
}

describe("resolvePosterGenerationRefUrls", () => {
  it("path C sends no refs even when slots filled", () => {
    expect(
      resolvePosterGenerationRefUrls({
        plan: plan({ easyPath: "C" }),
        references: refs,
      }),
    ).toEqual([]);
  });

  it("path A includes model garment scene", () => {
    const urls = resolvePosterGenerationRefUrls({
      plan: plan({ easyPath: "A" }),
      references: refs,
    });
    expect(urls).toContain("https://cdn.example/g.jpg");
    expect(urls).toContain("https://cdn.example/m.jpg");
    expect(urls).not.toContain("https://cdn.example/b.jpg");
  });

  it("pro text mode skips refs unless useBrandRefs", () => {
    expect(
      resolvePosterGenerationRefUrls({
        plan: plan({ tier: "pro", proMode: "text", useBrandRefs: true }),
        references: refs,
      }),
    ).toEqual(["https://cdn.example/b.jpg"]);
  });
});
