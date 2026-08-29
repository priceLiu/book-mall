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

  it("isFashionProduceSetupReady requires character mode only", () => {
    const project = {
      meta: {
        deliverable: { outputMode: "direct_video" },
        workflow: { vertical: "fashion_apparel" },
      },
    } as unknown as StoryboardProject;
    expect(isFashionProduceSetupReady(project)).toBe(false);

    const ready = {
      ...project,
      meta: {
        deliverable: { outputMode: "direct_video" },
        workflow: {
          vertical: "fashion_apparel",
          fashionCharacterMode: "ai",
        },
      },
    } as unknown as StoryboardProject;
    expect(isFashionProduceSetupReady(ready)).toBe(true);
  });
});
