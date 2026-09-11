import { describe, expect, it } from "vitest";

import {
  buildOutfitVideoMentionTokenCatalog,
  listOutfitVideoMentionEntries,
  stripOutfitVideoMentionTokensForVideoApi,
} from "@/lib/ecom/ecom-outfit-video-mention-refs";

describe("ecom-outfit-video-mention-refs", () => {
  it("lists model gallery then scene ref tokens", () => {
    const entries = listOutfitVideoMentionEntries({
      modelGallery: [
        { id: "m1", ossUrl: "https://example.com/a.jpg", label: "穿搭参考" },
        { id: "m2", ossUrl: "https://example.com/b.jpg", label: "细节" },
      ],
      sceneRef: { ossUrl: "https://example.com/scene.jpg", label: "白棚" },
    });
    expect(entries.map((e) => e.token)).toEqual(["@图片1", "@图片2", "@图片3"]);
    expect(entries[2]?.role).toBe("scene");
  });

  it("stripOutfitVideoMentionTokensForVideoApi replaces @ tokens for video APIs", () => {
    expect(stripOutfitVideoMentionTokensForVideoApi("模特穿着@图片1展示@图片2")).toBe(
      "模特穿着参考图1展示参考图2",
    );
  });

  it("buildOutfitVideoMentionTokenCatalog renders lines for LLM", () => {
    const catalog = buildOutfitVideoMentionTokenCatalog({
      modelGallery: [{ id: "m1", ossUrl: "https://example.com/a.jpg", label: "穿搭参考" }],
    });
    expect(catalog).toContain("@图片1 = 穿搭参考");
  });
});
