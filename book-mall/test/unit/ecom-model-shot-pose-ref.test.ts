import { describe, expect, it } from "vitest";

import { buildModelShotRefImageUrls } from "@/lib/ecom/model-shot/pose-ref";
import type { ModelShotReference } from "@/lib/ecom/ecom-model-shot-types";

const refs: ModelShotReference[] = [
  { id: "g", role: "garment", source: "upload", ossUrl: "https://cdn/g.webp" },
  { id: "m", role: "model", source: "upload", ossUrl: "https://cdn/m.webp" },
  { id: "s", role: "scene", source: "upload", ossUrl: "https://cdn/s.webp" },
];

describe("buildModelShotRefImageUrls", () => {
  it("orders refs garment → model → scene → poseRef", () => {
    const urls = buildModelShotRefImageUrls({
      references: refs,
      poseRefUrl: "https://cdn/p.webp",
      maxRefs: 10,
    });
    expect(urls).toEqual([
      "https://cdn/g.webp",
      "https://cdn/m.webp",
      "https://cdn/s.webp",
      "https://cdn/p.webp",
    ]);
  });

  it("drops scene first when over maxRefs, keeping garment model poseRef", () => {
    const urls = buildModelShotRefImageUrls({
      references: refs,
      poseRefUrl: "https://cdn/p.webp",
      maxRefs: 3,
    });
    expect(urls).toEqual([
      "https://cdn/g.webp",
      "https://cdn/m.webp",
      "https://cdn/p.webp",
    ]);
  });

  it("respects modelKey max ref cap via ecomStoryboardImageEditMaxRefs", () => {
    const urls = buildModelShotRefImageUrls({
      references: refs,
      poseRefUrl: "https://cdn/p.webp",
      modelKey: "qwen-image-edit",
    });
    expect(urls).toHaveLength(3);
    expect(urls).not.toContain("https://cdn/s.webp");
    expect(urls).toContain("https://cdn/p.webp");
  });
});
