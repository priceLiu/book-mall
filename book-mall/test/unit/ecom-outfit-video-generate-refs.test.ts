import { describe, expect, it } from "vitest";

import {
  buildOutfitBailianR2vReferenceUrlOrder,
  enrichOutfitBailianR2vGeneratePrompt,
} from "@/lib/ecom/ecom-outfit-video-generate-refs";

describe("ecom-outfit-video-generate-refs", () => {
  it("places model identity before preview and clip keyframes", () => {
    const order = buildOutfitBailianR2vReferenceUrlOrder({
      modelImageUrl: "https://example.com/model.jpg",
      clothingImageUrl: "https://example.com/model.jpg",
      previewImageUrl: "https://example.com/preview-old.jpg",
      clipKeyframeUrls: ["https://example.com/clip-frame.jpg"],
    });
    expect(order).toEqual([
      "https://example.com/model.jpg",
      "https://example.com/preview-old.jpg",
      "https://example.com/clip-frame.jpg",
    ]);
  });

  it("dedupes clothing when same as model", () => {
    const order = buildOutfitBailianR2vReferenceUrlOrder({
      modelImageUrl: "https://example.com/model.jpg",
      clothingImageUrl: "https://example.com/cloth.jpg",
      previewImageUrl: "https://example.com/preview-old.jpg",
    });
    expect(order[0]).toBe("https://example.com/model.jpg");
    expect(order[1]).toBe("https://example.com/cloth.jpg");
  });

  it("prefixes identity lock when prompt lacks it", () => {
    const out = enrichOutfitBailianR2vGeneratePrompt("9:16竖屏，电商穿搭");
    expect(out).toContain("参考图1");
    expect(out).toContain("同一人");
    expect(out).toContain("9:16竖屏");
  });

  it("does not double-prefix when prompt already locks identity", () => {
    const base = "人物以参考图1为准，全片同一人，展示服装";
    expect(enrichOutfitBailianR2vGeneratePrompt(base)).toBe(base);
  });
});
