import { describe, expect, it } from "vitest";

import {
  buildFashionProjectKeywords,
  isFashionProduceSetupReady,
} from "@/lib/fashion-workflow";
import type { FashionDeliverable } from "@/lib/fashion-types";
import type { StoryboardProject } from "@/lib/storyboard-types";

describe("fashion storyboard workspace helpers", () => {
  it("buildFashionProjectKeywords joins dimension fields", () => {
    const deliverable: FashionDeliverable = {
      schemaVersion: "fashion-v4",
      vertical: "fashion_apparel",
      productName: "Test",
      dimensions: {
        styleCategory: "连衣裙",
        styleAttribute: "职场办公",
        platform: "抖音",
        customScene: "都市通勤",
      },
      sellpoints: [],
      sellpointsLocked: true,
      voiceovers: [],
      selectedVoiceoverId: null,
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      outputMode: "direct_video",
    };
    expect(buildFashionProjectKeywords(deliverable)).toBe(
      "连衣裙 · 职场办公 · 抖音 · 都市通勤",
    );
  });

  it("isFashionProduceSetupReady accepts saved mode or uploaded model ref", () => {
    const deliverable: FashionDeliverable = {
      schemaVersion: "fashion-v4",
      vertical: "fashion_apparel",
      productName: "Test",
      dimensions: {},
      sellpoints: [],
      sellpointsLocked: true,
      voiceovers: [],
      selectedVoiceoverId: null,
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      outputMode: "direct_video",
    };
    const base = {
      references: [],
      chatHistory: [],
    } as unknown as StoryboardProject;

    const ready = {
      ...base,
      meta: {
        deliverable,
        workflow: {
          vertical: "fashion_apparel",
          fashionCharacterMode: "ai",
          fashionProduceSetupPending: true,
        },
      },
    } as unknown as StoryboardProject;
    expect(isFashionProduceSetupReady(ready)).toBe(true);

    const uploaded = {
      ...base,
      references: [
        {
          id: "c1",
          role: "character",
          label: "模特",
          ossUrl: "https://example.com/model.jpg",
        },
      ],
      meta: {
        deliverable,
        workflow: { vertical: "fashion_apparel", fashionProduceSetupPending: true },
      },
    } as unknown as StoryboardProject;
    expect(isFashionProduceSetupReady(uploaded)).toBe(true);
  });
});
