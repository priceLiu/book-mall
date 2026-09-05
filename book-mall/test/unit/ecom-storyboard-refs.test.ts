import { describe, expect, it } from "vitest";

import {
  getStoryboardProductRefs,
  resolveStoryboardImageGenRefs,
  resolveStoryboardModelRefUrls,
} from "@/lib/ecom/ecom-storyboard-refs";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";

function ref(
  id: string,
  role: StoryboardReference["role"],
  ossUrl: string,
): StoryboardReference {
  return { id, role, label: id, ossUrl };
}

describe("getStoryboardProductRefs", () => {
  it("returns all product refs in upload order and dedupes urls", () => {
    const refs = [
      ref("p1", "product", "https://cdn.example.com/a.jpg"),
      ref("p2", "product", "https://cdn.example.com/b.jpg"),
      ref("p3", "product", "https://cdn.example.com/a.jpg"),
      ref("c1", "character", "https://cdn.example.com/char.jpg"),
    ];
    expect(getStoryboardProductRefs(refs).map((r) => r.id)).toEqual(["p1", "p2"]);
  });
});

describe("resolveStoryboardModelRefUrls", () => {
  it("includes every product url before character and scene refs", () => {
    const refs = [
      ref("p1", "product", "https://cdn.example.com/p1.jpg"),
      ref("p2", "product", "https://cdn.example.com/p2.jpg"),
      ref("c1", "character", "https://cdn.example.com/c1.jpg"),
      ref("s1", "scene", "https://cdn.example.com/s1.jpg"),
    ];
    const resolved = resolveStoryboardModelRefUrls(refs);
    expect(resolved.productUrls).toEqual([
      "https://cdn.example.com/p1.jpg",
      "https://cdn.example.com/p2.jpg",
    ]);
    expect(resolved.allUrls).toEqual([
      "https://cdn.example.com/p1.jpg",
      "https://cdn.example.com/p2.jpg",
      "https://cdn.example.com/c1.jpg",
      "https://cdn.example.com/s1.jpg",
    ]);
  });
});

describe("resolveStoryboardImageGenRefs", () => {
  it("exposes refImageUrls with all products for panel image gen", () => {
    const refs = [
      ref("p1", "product", "https://cdn.example.com/p1.jpg"),
      ref("p2", "product", "https://cdn.example.com/p2.jpg"),
    ];
    const { refImageUrls, productRefUrls } = resolveStoryboardImageGenRefs(refs);
    expect(productRefUrls).toHaveLength(2);
    expect(refImageUrls).toEqual([
      "https://cdn.example.com/p1.jpg",
      "https://cdn.example.com/p2.jpg",
    ]);
  });
});
