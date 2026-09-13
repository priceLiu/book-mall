import { describe, expect, it } from "vitest";

import { buildCanvasVideoKieInput } from "@/lib/canvas/canvas-video-kie";

describe("buildCanvasVideoKieInput · kling/v3-turbo-image-to-video", () => {
  it("omni mode sends main + extra ref (up to 2 urls)", () => {
    const { input } = buildCanvasVideoKieInput({
      modelKey: "kling/v3-turbo-image-to-video",
      prompt: "test",
      imageUrl: "https://oss.example/a.png",
      referenceImageUrls: ["https://oss.example/b.png"],
    });
    expect(input.image_urls).toEqual([
      "https://oss.example/a.png",
      "https://oss.example/b.png",
    ]);
  });

  it("first_last mode prefers main + last over extra refs", () => {
    const { input } = buildCanvasVideoKieInput({
      modelKey: "kling/v3-turbo-image-to-video",
      prompt: "test",
      imageUrl: "https://oss.example/a.png",
      referenceImageUrls: ["https://oss.example/b.png"],
      lastFrameUrl: "https://oss.example/z.png",
    });
    expect(input.image_urls).toEqual([
      "https://oss.example/a.png",
      "https://oss.example/z.png",
    ]);
  });
});
