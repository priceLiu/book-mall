import { describe, expect, it } from "vitest";

import type { FashionDeliverable } from "@/lib/fashion-types";
import {
  FASHION_OUTPUT_VIDEO,
  fashionWorkflowPatchForChoice,
  inferFashionChoices,
  isFashionInProduce,
  isAwaitingFashionOutputMode,
} from "@/lib/fashion-workflow";
import type { StoryboardProject } from "@/lib/storyboard-types";

function fashionProject(
  deliverable: Partial<FashionDeliverable>,
  workflow?: Record<string, unknown>,
): StoryboardProject {
  const base: FashionDeliverable = {
    schemaVersion: "fashion-v4",
    vertical: "fashion_apparel",
    productName: "测试款",
    dimensions: {},
    sellpoints: [{ id: "SP01", text: "抗皱", layer: "core", source: "ai" }],
    sellpointsLocked: true,
    voiceovers: [{ id: "V01", type: "情绪", narrative: "口播", script: "脚本" }],
    selectedVoiceoverId: "V01",
    storyboardVersions: {
      C: {
        id: "C",
        title: "情绪氛围式",
        panels: Array.from({ length: 6 }, (_, i) => ({
          index: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
          shotScale: "中景",
          durationSec: 4,
          cameraMove: "固定",
          sceneDesc: "场景",
          modelAction: "动作",
          garmentFocus: "展示",
          sellpointIds: ["SP01"],
          imagePrompt: "竖版9:16，写实UGC摄影，服装展示，禁止画面文字。",
        })),
      },
    },
    selectedVersion: "C",
    storyboardLocked: true,
    coverageChecklist: [],
    outputMode: null,
    opsPack: { titles: ["标题1"] },
    ...deliverable,
  };
  return {
    id: "proj-1",
    references: [{ role: "product", url: "https://example.com/p.jpg" }],
    chatHistory: [],
    meta: {
      deliverable: base,
      workflow: {
        vertical: "fashion_apparel",
        fashionPhase: "output_mode",
        ...workflow,
      },
    },
  } as StoryboardProject;
}

describe("fashion Path B direct_video flow", () => {
  it("output video patch sets produce + syncSheet", () => {
    const project = fashionProject({});
    const patch = fashionWorkflowPatchForChoice(project, FASHION_OUTPUT_VIDEO);
    expect(patch?.syncSheet).toBe(true);
    expect(patch?.workflow?.fashionPhase).toBe("produce");
    expect((patch?.deliverable as FashionDeliverable)?.outputMode).toBe("direct_video");
  });

  it("does not re-patch when already in produce with direct_video", () => {
    const project = fashionProject(
      { outputMode: "direct_video" },
      { fashionPhase: "produce" },
    );
    expect(fashionWorkflowPatchForChoice(project, FASHION_OUTPUT_VIDEO)).toBeNull();
    expect(isFashionInProduce(project)).toBe(true);
    expect(isAwaitingFashionOutputMode(project)).toBe(false);
    expect(inferFashionChoices(project)).toEqual([]);
  });
});
