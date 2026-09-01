import { describe, expect, it } from "vitest";

import {
  buildModelShotAssistantChoiceCards,
  buildModelShotHistoricalChoiceBlock,
  resolveModelShotAssistantChoiceStep,
  resolveModelShotAssistantHeaderSubtitle,
} from "@/lib/model-shot-assistant-choice-ui";
import { MODEL_SHOT_STYLE_CHOICE_PREFIX } from "@/lib/model-shot-workflow";
import { MODEL_SHOT_SCENE_MODE_PREFIX } from "@/lib/model-shot-prompt-presets";
import type { ModelShotProject } from "@/lib/model-shot-types";

function baseProject(overrides: Partial<ModelShotProject> = {}): ModelShotProject {
  return {
    id: "p1",
    title: "测试",
    module: "model-shot",
    status: "draft",
    settings: {},
    references: [
      {
        id: "g1",
        role: "garment",
        source: "upload",
        ossUrl: "https://example.com/g.jpg",
      },
      { id: "m1", role: "model", source: "text", name: "模特" },
      { id: "s1", role: "scene", source: "none", name: "跳过" },
    ],
    brief: {},
    plan: { status: "draft", items: [] },
    chatHistory: [],
    meta: { propDeferred: true, wizard: {} },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("model-shot-assistant-choice-ui", () => {
  it("maps style choices to cards with descriptions", () => {
    const message = `${MODEL_SHOT_STYLE_CHOICE_PREFIX}静奢知性`;
    const cards = buildModelShotAssistantChoiceCards(baseProject(), [message]);
    expect(cards[0]?.title).toBe("静奢知性");
    expect(cards[0]?.description).toBe("优雅 · 知性");
  });

  it("resolves meta style step header", () => {
    const step = resolveModelShotAssistantChoiceStep(baseProject());
    expect(step?.title).toBe("风格调性");
    expect(step?.progress).toBe("4/4 · 1/3");
    expect(resolveModelShotAssistantHeaderSubtitle(baseProject())).toContain("风格调性");
  });

  it("builds historical block for skip scene with selected card", () => {
    const message = `${MODEL_SHOT_SCENE_MODE_PREFIX}跳过场景`;
    const block = buildModelShotHistoricalChoiceBlock(message, baseProject());
    expect(block?.title).toBe("已选 · 场景方式");
    expect(block?.selectedMessage).toBe(message);
    expect(block?.cards.some((c) => c.message === message)).toBe(true);
    expect(block?.cards).toHaveLength(4);
  });
});
