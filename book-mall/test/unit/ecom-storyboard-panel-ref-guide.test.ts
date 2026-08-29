import { describe, expect, it } from "vitest";

import {
  buildStoryboardImagePromptContext,
  buildStoryboardPanelImagePrompt,
  buildStoryboardPanelInvokePrompt,
  buildStoryboardPanelRefGuideForUrls,
  resolveStoryboardPanelImagePrompt,
} from "@/lib/ecom/ecom-storyboard-image-prompt";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";

describe("buildStoryboardPanelRefGuideForUrls", () => {
  const refs: StoryboardReference[] = [
    {
      id: "p1",
      label: "产品",
      role: "product",
      ossUrl: "https://cdn.example.com/product.jpg",
    },
    {
      id: "c1",
      label: "角色",
      role: "character",
      ossUrl: "https://cdn.example.com/char.jpg",
    },
    {
      id: "s1",
      label: "场景",
      role: "scene",
      ossUrl: "https://cdn.example.com/scene.jpg",
    },
    {
      id: "s2",
      label: "场景2",
      role: "scene",
      ossUrl: "https://cdn.example.com/scene2.jpg",
    },
  ];

  it("numbers refs to match sliced url list", () => {
    const urls = refs.map((r) => r.ossUrl).slice(0, 3);
    const guide = buildStoryboardPanelRefGuideForUrls(urls, refs);
    expect(guide).toContain("图1为产品");
    expect(guide).toContain("图2为角色");
    expect(guide).toContain("图3为场景");
    expect(guide).not.toContain("图4");
  });

  it("product-only guide when only product url sent", () => {
    const guide = buildStoryboardPanelRefGuideForUrls(
      ["https://cdn.example.com/product.jpg"],
      refs,
    );
    expect(guide).toBe(
      "图1为产品包装参考，画面中须自然露出该产品，包装形态、Logo、配色与材质须与参考图一致",
    );
  });
});

describe("buildStoryboardPanelImagePrompt", () => {
  it("filters placeholder product param and uses Chinese prompt", () => {
    const ctx = buildStoryboardImagePromptContext({
      meta: {
        workflow: {
          collectedParams: { 产品信息: "沿用产品名作卖点" },
        },
        deliverable: { productName: "灰紫冲锋衣" },
      },
      settings: { aspectRatio: "9:16" },
    });
    const prompt = buildStoryboardPanelImagePrompt(
      {
        index: 1,
        shotType: "近景",
        camera: "手持",
        scene: "屋檐下大雨",
        action: "看裤脚",
        emotion: "焦虑",
      },
      {
        overview: { title: "方案A", logline: "test", productHighlight: "沿用产品名作卖点" },
        cast: [],
        panels: [],
        totalDurationHintSec: 10,
      },
      [
        {
          id: "p1",
          label: "产品",
          role: "product",
          ossUrl: "https://cdn.example.com/p.png",
        },
      ],
      ctx,
      ["https://cdn.example.com/p.png"],
    );
    expect(prompt).not.toContain("沿用产品名作卖点");
    expect(prompt).toContain("灰紫冲锋衣");
    expect(prompt).toContain("根据参考图进行图像编辑");
    expect(prompt).toContain("严格还原参考图1的产品包装");
    expect(prompt).toContain("竖版 9:16");
  });

  it("prefers panel.imagePrompt when present", () => {
    const ctx = buildStoryboardImagePromptContext({
      meta: { deliverable: { productName: "灰紫冲锋衣" } },
      settings: { aspectRatio: "9:16" },
    });
    const prompt = resolveStoryboardPanelImagePrompt(
      {
        index: 2,
        shotType: "中景",
        scene: "街边",
        action: "拉拉链",
        imagePrompt: "竖版9:16，写实UGC。女生穿灰紫冲锋衣拉拉链，以参考图1为准。",
        productInteraction: "wear",
      },
      {
        overview: { title: "方案A", logline: "test" },
        cast: [],
        panels: [],
      },
      [
        {
          id: "p1",
          label: "产品",
          role: "product",
          ossUrl: "https://cdn.example.com/p.png",
        },
      ],
      ctx,
      ["https://cdn.example.com/p.png"],
      "图1为产品包装参考",
    );
    expect(prompt).toContain("灰紫冲锋衣拉拉链");
    expect(prompt).not.toContain("场景与背景须严格符合");
  });
});

describe("buildStoryboardPanelInvokePrompt", () => {
  it("omits refGuide when refs are in multimodal content", () => {
    const panelPrompt = "场景：大雨屋檐";
    const refGuide = "图1为产品包装参考";
    expect(
      buildStoryboardPanelInvokePrompt({
        refGuide,
        panelPrompt,
        refCount: 1,
      }),
    ).toBe(panelPrompt);
  });

  it("keeps refGuide for text-only generation", () => {
    const panelPrompt = "场景：大雨屋檐";
    const refGuide = "图1为产品包装参考";
    expect(
      buildStoryboardPanelInvokePrompt({
        refGuide,
        panelPrompt,
        refCount: 0,
      }),
    ).toBe(`${refGuide}\n\n${panelPrompt}`);
  });
});
