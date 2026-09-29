import { describe, expect, it } from "vitest";

import {
  getStoryboardVideoInvokeRules,
  resolveStoryboardPanelVideoRefPlan,
  resolveStoryboardVideoRefPlan,
} from "@/lib/ecom/ecom-storyboard-video-ref-rules";
import { buildEcomStoryboardVideoPrompt } from "@/lib/ecom/ecom-storyboard-video-prompt";
import type {
  StoryboardReference,
  StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";

describe("resolveStoryboardPanelVideoRefPlan", () => {
  const references: StoryboardReference[] = [
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
      label: "场景1",
      role: "scene",
      ossUrl: "https://cdn.example.com/scene1.jpg",
    },
    {
      id: "s2",
      label: "场景2",
      role: "scene",
      ossUrl: "https://cdn.example.com/scene2.jpg",
    },
  ];

  it("keeps character ref before scene refs when cap is tight (wan2.6 R2V)", () => {
    const plan = resolveStoryboardPanelVideoRefPlan({
      modelKey: "wan2.6-r2v",
      references,
      panelImageUrl: "https://cdn.example.com/panel1.jpg",
    });
    const roles = plan.slots.map((s) => s.role);
    expect(roles[0]).toBe("panel");
    expect(roles).toContain("product");
    expect(roles).toContain("character");
    const charIdx = roles.indexOf("character");
    const sceneIdx = roles.indexOf("scene");
    expect(charIdx).toBeGreaterThan(0);
    if (sceneIdx >= 0) {
      expect(charIdx).toBeLessThan(sceneIdx);
    }
  });
});

describe("resolveStoryboardVideoRefPlan HappyHorse full sheet", () => {
  const references: StoryboardReference[] = [
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
  ];

  const sixPanels = Array.from({ length: 6 }, (_, i) => ({
    index: i + 1,
    url: `https://cdn.example.com/panel-${i + 1}.jpg`,
  }));

  const eightPanels = Array.from({ length: 8 }, (_, i) => ({
    index: i + 1,
    url: `https://cdn.example.com/panel-${i + 1}.jpg`,
  }));

  it("uses per-panel originals for happyhorse-1.1-r2v instead of a compressed grid", () => {
    expect(getStoryboardVideoInvokeRules("happyhorse-1.1-r2v").strategy).toBe(
      "bailian_happyhorse_panels",
    );
    const plan = resolveStoryboardVideoRefPlan({
      modelKey: "happyhorse-1.1-r2v",
      references,
      sheetPngUrl: "https://cdn.example.com/grid.png",
      panelImages: sixPanels,
    });
    const panelSlots = plan.slots.filter((s) => s.role === "panel");
    expect(panelSlots).toHaveLength(6);
    expect(panelSlots.map((s) => s.panelIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan.slots.some((s) => s.role === "full_sheet")).toBe(false);
    expect(plan.bailianAllUrls).toEqual([
      ...sixPanels.map((p) => p.url),
      "https://cdn.example.com/product.jpg",
      "https://cdn.example.com/char.jpg",
      "https://cdn.example.com/scene.jpg",
    ]);
  });

  it("keeps all 8 panels and reserves the last slot for product on HappyHorse", () => {
    const plan = resolveStoryboardVideoRefPlan({
      modelKey: "happyhorse-1.1-r2v",
      references,
      sheetPngUrl: "https://cdn.example.com/grid.png",
      panelImages: eightPanels,
    });
    expect(plan.slots.filter((s) => s.role === "panel")).toHaveLength(8);
    expect(plan.slots.map((s) => s.role)).toEqual([
      "panel",
      "panel",
      "panel",
      "panel",
      "panel",
      "panel",
      "panel",
      "panel",
      "product",
    ]);
    expect(plan.slots).toHaveLength(9);
  });

  it("still sends a compressed grid for wan2.7-r2v, not individual panels", () => {
    const plan = resolveStoryboardVideoRefPlan({
      modelKey: "wan2.7-r2v",
      references,
      sheetPngUrl: "https://cdn.example.com/grid.png",
      panelImages: sixPanels,
    });
    expect(plan.rules.strategy).toBe("bailian_storyboard_grid");
    expect(plan.slots[0]?.role).toBe("full_sheet");
    expect(plan.slots.filter((s) => s.role === "panel")).toHaveLength(0);
  });
});

describe("buildEcomStoryboardVideoPrompt HappyHorse panels", () => {
  const sheet: StoryboardSheet = {
    overview: { title: "春季外套", logline: "通勤穿搭" },
    cast: [{ name: "模特", role: "主角" }],
    panels: [
      {
        index: 1,
        shotType: "特写",
        scene: "通勤地铁",
        action: "整理领口",
      },
      {
        index: 2,
        shotType: "全身",
        scene: "街道",
        action: "转身展示",
      },
    ],
    totalDurationHintSec: 10,
  };

  it("binds each shot to its panel [Image N] and does not tell the model to ignore storyboard frames", () => {
    const plan = resolveStoryboardVideoRefPlan({
      modelKey: "happyhorse-1.1-r2v",
      references: [
        {
          id: "p1",
          label: "外套",
          role: "product",
          ossUrl: "https://cdn.example.com/product.jpg",
        },
      ],
      sheetPngUrl: "https://cdn.example.com/grid.png",
      panelImages: [
        { index: 1, url: "https://cdn.example.com/p1.jpg" },
        { index: 2, url: "https://cdn.example.com/p2.jpg" },
      ],
    });
    const prompt = buildEcomStoryboardVideoPrompt(sheet, undefined, [], {
      refSlots: plan.slots,
      refRules: plan.rules,
    });
    expect(prompt).toContain("[Image 1]为镜头1分镜原图");
    expect(prompt).toContain("[Image 2]为镜头2分镜原图");
    expect(prompt).toContain("构图场面须与[Image 1]一致");
    expect(prompt).toContain("构图场面须与[Image 2]一致");
    expect(prompt).toContain("各镜头须按对应分镜参考图");
    expect(prompt).not.toContain("故事板仅作节奏");
    expect(prompt).not.toContain("不得采用其中的产品包装");
  });
});
