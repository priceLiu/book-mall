import { describe, expect, it } from "vitest";

import {
  listStoryTheaterVersionKeys,
  parseStoryTheaterVersionChoice,
  parseStoryTopicChoice,
  PRODUCTION_MODE_SCRIPT,
  PRODUCTION_MODE_STORY,
  storyTopicChoiceLabel,
} from "@/lib/story-theater-workflow";
import {
  effectiveProductionMode,
  isStoryTheaterProductionMode,
} from "@/lib/story-theater-types";
import { inferFashionPhaseFromState } from "@/lib/fashion-workflow";
import type { StoryboardProject } from "@/lib/storyboard-types";

describe("story-theater-workflow", () => {
  it("parses production mode and topic/version choices", () => {
    expect(parseStoryTopicChoice(storyTopicChoiceLabel("出门前焦虑"))).toBe("出门前焦虑");
    expect(parseStoryTheaterVersionChoice("选择故事版 T3")).toBe("T3");
    expect(PRODUCTION_MODE_SCRIPT).toContain("标准线");
    expect(PRODUCTION_MODE_STORY).toContain("故事剧场");
  });

  it("defaults legacy productionMode to standard_script", () => {
    expect(effectiveProductionMode(null)).toBe("standard_script");
    expect(isStoryTheaterProductionMode("story_theater")).toBe(true);
  });

  it("lists story theater version keys with panels", () => {
    const keys = listStoryTheaterVersionKeys({
      storyTheaterVersions: {
        T1: { id: "T1", title: "a", panels: [{ index: 1 } as never] },
      },
    });
    expect(keys).toEqual(["T1"]);
  });
});

describe("inferFashionPhaseFromState · story theater", () => {
  const baseProject = (deliverable: Record<string, unknown>): StoryboardProject => ({
    id: "p1",
    title: "test",
    status: "draft",
    chatHistory: [],
    references: [{ id: "r1", role: "product", url: "https://x/y.png", label: "产品" }],
    meta: {
      workflow: { vertical: "fashion_apparel", fashionPhase: "sellpoints" },
      deliverable,
    },
  });

  it("routes to production_mode before sellpoints when dimensions done", () => {
    const project = baseProject({
      schemaVersion: "fashion-v4",
      vertical: "fashion_apparel",
      productName: "裙",
      dimensions: {
        genderCategory: "女装",
        styleCategory: "连衣裙",
        styleAttribute: "日常休闲",
        tier: "中端质感",
        customScene: "通勤",
        platform: "抖音",
        outputLanguage: "中文",
      },
      sellpoints: [],
      sellpointsLocked: false,
    });
    expect(inferFashionPhaseFromState(project)).toBe("production_mode");
  });

  it("routes story line to story_topic_pick after sellpoints locked", () => {
    const project = baseProject({
      schemaVersion: "fashion-v4",
      vertical: "fashion_apparel",
      productName: "裙",
      dimensions: { genderCategory: "女装" },
      productionMode: "story_theater",
      sellpoints: [{ id: "S01", text: "显瘦", layer: "core", source: "ai" }],
      sellpointsLocked: true,
    });
    expect(inferFashionPhaseFromState(project)).toBe("story_topic_pick");
  });
});
