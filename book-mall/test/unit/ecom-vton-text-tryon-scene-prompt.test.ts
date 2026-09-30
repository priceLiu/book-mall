import { describe, expect, it } from "vitest";

import { resolveTextTryonRefUrls } from "@/lib/ecom/ecom-vton-text-tryon";
import { expandVtonTextTryonPromptSceneTokens } from "@/lib/ecom/ecom-vton-text-tryon-scene-prompt";
import type { VtonTextTryonRef } from "@/lib/ecom/ecom-vton/types";

describe("vton text tryon scene refs", () => {
  it("expands @场景N to scene prompt fragment", () => {
    const refs: VtonTextTryonRef[] = [
      {
        id: "s1",
        kind: "scene-text",
        createdAt: "t",
        scenePrompt: "极简灰色摄影棚柔光背景",
      },
      {
        id: "i1",
        kind: "image",
        createdAt: "t",
        ossUrl: "https://example.com/a.jpg",
      },
    ];
    const out = expandVtonTextTryonPromptSceneTokens(
      "模特站在@场景1，穿@图片1",
      refs,
    );
    expect(out).toContain("极简灰色摄影棚柔光背景");
    expect(out).toContain("@图片1");
  });

  it("maps @图片N only to image refs", () => {
    const refs: VtonTextTryonRef[] = [
      {
        id: "s1",
        kind: "scene-text",
        createdAt: "t",
        scenePrompt: "scene",
      },
      {
        id: "i1",
        kind: "image",
        createdAt: "t",
        ossUrl: "https://example.com/a.jpg",
      },
    ];
    expect(resolveTextTryonRefUrls(refs, "@图片1", 9)).toEqual([
      "https://example.com/a.jpg",
    ]);
  });
});
