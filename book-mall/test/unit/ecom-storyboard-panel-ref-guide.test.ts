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

  it("fashion apparel uses garment color guide for product and splits character clothing", () => {
    const fashionCtx = buildStoryboardImagePromptContext({
      meta: { workflow: { vertical: "fashion_apparel" } },
    });
    expect(fashionCtx.productCategory).toBe("fashion");

    const urls = [
      "https://cdn.example.com/product.jpg",
      "https://cdn.example.com/char.jpg",
    ];
    const guide = buildStoryboardPanelRefGuideForUrls(urls, refs, fashionCtx);
    expect(guide).toContain("图1为服装产品参考");
    expect(guide).toContain("禁止擅自改色或换款");
    expect(guide).toContain("图2为角色参考");
    expect(guide).toContain("服装款式与颜色以图1产品参考为准");
    expect(guide).not.toContain("图2为角色参考，人物面部、发型、体型与服装须与参考图完全一致");
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

  it("prefers panel.imagePrompt and merges scenePrompt", () => {
    const ctx = buildStoryboardImagePromptContext({
      meta: { deliverable: { productName: "灰紫冲锋衣" } },
      settings: { aspectRatio: "9:16" },
    });
    const prompt = resolveStoryboardPanelImagePrompt(
      {
        index: 2,
        shotType: "中景",
        scene: "街边",
        scenePrompt: "雨后街边，冷色反光地面，都市通勤背景",
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
    expect(prompt).toContain("雨后街边");
    expect(prompt).not.toContain("场景与背景须严格符合");
  });

  it("fashion panel prompt prioritizes product ref color over script text", () => {
    const ctx = buildStoryboardImagePromptContext({
      meta: { workflow: { vertical: "fashion_apparel" } },
      settings: { aspectRatio: "9:16" },
    });
    const prompt = resolveStoryboardPanelImagePrompt(
      {
        index: 1,
        shotType: "全景",
        scene: "商场中庭",
        action: "模特行走",
        imagePrompt: "竖版9:16，写实UGC。女生穿浅灰色连衣裙在商场行走。",
        productInteraction: "wear",
      },
      {
        overview: { title: "轻奢连衣裙", logline: "test" },
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
        {
          id: "c1",
          label: "角色",
          role: "character",
          ossUrl: "https://cdn.example.com/c.png",
        },
      ],
      ctx,
      ["https://cdn.example.com/p.png", "https://cdn.example.com/c.png"],
      "图1为服装产品参考；图2为角色参考",
    );
    expect(prompt).toContain("禁止擅自改色或换款");
    expect(prompt).toContain("浅灰色连衣裙");
  });

  it("fashion legacy prompt locks garment to product ref when character ref present", () => {
    const ctx = buildStoryboardImagePromptContext({
      meta: { workflow: { vertical: "fashion_apparel" } },
      settings: { aspectRatio: "9:16" },
    });
    const prompt = buildStoryboardPanelImagePrompt(
      {
        index: 1,
        shotType: "全景",
        scene: "商场中庭",
        action: "模特行走",
        emotion: "自信",
      },
      {
        overview: { title: "轻奢连衣裙", logline: "test" },
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
        {
          id: "c1",
          label: "角色",
          role: "character",
          ossUrl: "https://cdn.example.com/c.png",
        },
      ],
      ctx,
      ["https://cdn.example.com/p.png", "https://cdn.example.com/c.png"],
    );
    expect(prompt).toContain("服装款式、颜色与细节须严格以参考图1产品图为准");
  });

  it("uses scene ref constraint when scene image uploaded", () => {
    const ctx = buildStoryboardImagePromptContext({
      meta: { deliverable: { productName: "灰紫冲锋衣" } },
      settings: { aspectRatio: "9:16" },
    });
    const prompt = resolveStoryboardPanelImagePrompt(
      {
        index: 1,
        shotType: "近景",
        scene: "试衣镜前",
        scenePrompt: "靠近全身镜，暖色顶光",
        action: "整理衣领",
        imagePrompt: "竖版9:16，写实UGC，女生整理衣领",
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
        {
          id: "s1",
          label: "场景",
          role: "scene",
          ossUrl: "https://cdn.example.com/scene.jpg",
        },
      ],
      ctx,
      ["https://cdn.example.com/p.png", "https://cdn.example.com/scene.jpg"],
      "图1为产品；图2为场景",
    );
    expect(prompt).toContain("场景参考图一致");
  });
});

describe("buildStoryboardPanelInvokePrompt", () => {
  it("includes refGuide alongside multimodal refs so image roles are explicit", () => {
    const panelPrompt = "场景：大雨屋檐";
    const refGuide = "图1为产品包装参考；图2为角色参考，人物面部、发型、体型与服装须与参考图完全一致";
    expect(
      buildStoryboardPanelInvokePrompt({
        refGuide,
        panelPrompt,
        refCount: 2,
      }),
    ).toBe(`${refGuide}\n\n${panelPrompt}`);
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
