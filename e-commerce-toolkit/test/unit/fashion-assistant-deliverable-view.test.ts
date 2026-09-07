import { describe, expect, it } from "vitest";

import {
  isNonSellpointDeliverableMessage,
  parsedMessageHasStoryTheaterContent,
  shouldReplaySellpointsInAssistant,
} from "@/lib/fashion-assistant-deliverable-display";
import type { ProDeliverable } from "@/lib/pro-vertical/types";

describe("fashion-assistant-deliverable-view helpers", () => {
  const storyTheaterDeliverable: ProDeliverable = {
    schemaVersion: "pro-v1",
    vertical: "bags",
    productionMode: "story_theater",
    productName: "测试包",
    dimensions: { productCategory: "包", outputLanguage: "中文" },
    sellpoints: [{ id: "S01", text: "轻便", layer: "core", source: "ai" }],
    sellpointsLocked: true,
    selectedStoryTopic: {
      id: "t1",
      title: "通勤主题",
      storyCore: "核心",
      storyType: "场景适配",
    },
    storyTheaterVersions: {},
    voiceovers: [],
    storyboardVersions: {},
    selectedVersion: null,
    coverageChecklist: [],
    outputMode: null,
  };

  it("treats story theater versions as non-sellpoint phase", () => {
    expect(
      isNonSellpointDeliverableMessage({
        sellpoints: [{ id: "S01", text: "x", layer: "core", source: "ai" }],
        storyTheaterVersions: {
          T1: { id: "T1", title: "T1", panels: [] },
        },
      }),
    ).toBe(true);
  });

  it("suppresses sellpoint replay after story topic is selected", () => {
    expect(shouldReplaySellpointsInAssistant(storyTheaterDeliverable)).toBe(false);
  });

  it("allows sellpoint replay before story topic on story theater line", () => {
    expect(
      shouldReplaySellpointsInAssistant({
        ...storyTheaterDeliverable,
        selectedStoryTopic: null,
        storyTheaterVersions: {},
      }),
    ).toBe(true);
  });

  it("detects story theater content in parsed assistant JSON", () => {
    expect(
      parsedMessageHasStoryTheaterContent({
        selectedStoryTopic: storyTheaterDeliverable.selectedStoryTopic,
      }),
    ).toBe(true);
    expect(
      parsedMessageHasStoryTheaterContent({
        storyTheaterVersions: {
          T2: { id: "T2", title: "T2", panels: [] },
        },
      }),
    ).toBe(true);
  });
});
