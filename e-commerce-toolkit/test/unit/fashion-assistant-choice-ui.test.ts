import { describe, expect, it } from "vitest";

import { buildFashionHistoricalChoiceBlock } from "@/lib/fashion-assistant-choice-ui";
import { buildFashionDimensionMessageLabels } from "@/lib/fashion-dimensions";
import {
  buildFashionWorkflowChoiceMessageLabels,
  FASHION_AI_POLISH_SELLPOINTS,
  FASHION_AI_SELLPOINTS_CHOICE,
  FASHION_CUSTOM_DIMENSION_CHOICE,
  FASHION_LOCK_SELLPOINTS,
  FASHION_REGENERATE_SELLPOINTS,
} from "@/lib/fashion-workflow";
import {
  PRODUCTION_MODE_STORY,
  storyTheaterVersionChoiceLabel,
  storyTopicChoiceLabel,
} from "@/lib/story-theater-workflow";
import type { StoryboardProject } from "@/lib/storyboard-types";

function baseProject(deliverable: Record<string, unknown> = {}): StoryboardProject {
  return {
    id: "proj-1",
    title: "测试项目",
    chatHistory: [],
    references: [{ id: "r1", role: "product", url: "https://x/y.png", label: "产品" }],
    meta: {
      deliverable: {
        schemaVersion: "fashion-v4",
        vertical: "fashion_apparel",
        ...deliverable,
      },
    },
  } as unknown as StoryboardProject;
}

describe("buildFashionHistoricalChoiceBlock", () => {
  it("replays dimension pick as full read-only cards with selection", () => {
    const priorMessages = [
      { id: "a1", role: "assistant" as const, content: "请选择性别品类", createdAt: "" },
      { id: "u1", role: "user" as const, content: "女装", createdAt: "" },
    ];
    const labels = buildFashionDimensionMessageLabels(priorMessages);
    const block = buildFashionHistoricalChoiceBlock({
      userMessage: "女装",
      project: baseProject(),
      dimMeta: labels.get("u1"),
      priorMessages,
    });
    expect(block).not.toBeNull();
    expect(block!.title).toBe("性别品类");
    expect(block!.selectedMessage).toBe("女装");
    expect(block!.cards.length).toBeGreaterThan(2);
    expect(block!.cards.some((c) => c.message === "女装")).toBe(true);
    expect(block!.cards.some((c) => c.message === "男装")).toBe(true);
  });

  it("adds custom value card when user typed after 自定义", () => {
    const priorMessages = [
      { id: "u1", role: "user" as const, content: "女装", createdAt: "" },
      { id: "u2", role: "user" as const, content: FASHION_CUSTOM_DIMENSION_CHOICE, createdAt: "" },
    ];
    const customStyle = "轻户外机能风";
    const allMessages = [
      ...priorMessages,
      { id: "u3", role: "user" as const, content: customStyle, createdAt: "" },
    ];
    const labels = buildFashionDimensionMessageLabels(allMessages);
    const block = buildFashionHistoricalChoiceBlock({
      userMessage: customStyle,
      project: baseProject(),
      dimMeta: labels.get("u3"),
      priorMessages: allMessages.slice(0, 2),
    });
    expect(block).not.toBeNull();
    expect(block!.cards.some((c) => c.message === customStyle)).toBe(true);
    expect(block!.cards.some((c) => c.message === "T恤")).toBe(true);
  });

  it("replays AI sellpoint mode pick with both cards and selection", () => {
    const priorMessages = [
      { id: "u-ai", role: "user" as const, content: FASHION_AI_SELLPOINTS_CHOICE, createdAt: "" },
    ];
    const block = buildFashionHistoricalChoiceBlock({
      userMessage: FASHION_AI_SELLPOINTS_CHOICE,
      project: baseProject({
        productionMode: "story_theater",
      }),
      priorMessages: [],
    });
    expect(block).not.toBeNull();
    expect(block!.title).toBe("卖点录入");
    expect(block!.selectedMessage).toBe(FASHION_AI_SELLPOINTS_CHOICE);
    expect(block!.cards).toHaveLength(2);
    expect(block!.cards.some((c) => c.message === FASHION_AI_SELLPOINTS_CHOICE)).toBe(true);
  });

  it("replays sellpoint lock after AI path with lock + regen cards", () => {
    const priorMessages = [
      { id: "u-ai", role: "user" as const, content: FASHION_AI_SELLPOINTS_CHOICE, createdAt: "" },
    ];
    const project = {
      ...baseProject({
        productionMode: "story_theater",
        sellpointsLocked: true,
        sellpoints: [{ id: "SP01", text: "test", tier: "core", source: "ai" }],
      }),
      meta: {
        deliverable: {
          schemaVersion: "fashion-v4",
          vertical: "fashion_apparel",
          productionMode: "story_theater",
          sellpointsLocked: true,
          sellpoints: [{ id: "SP01", text: "test", tier: "core", source: "ai" }],
        },
        workflow: { sellpointInputMode: "ai" },
      },
    } as unknown as StoryboardProject;
    const labels = buildFashionWorkflowChoiceMessageLabels([
      ...priorMessages,
      { id: "u-lock", role: "user", content: FASHION_LOCK_SELLPOINTS, createdAt: "" },
    ]);
    const block = buildFashionHistoricalChoiceBlock({
      userMessage: FASHION_LOCK_SELLPOINTS,
      project,
      choiceMeta: labels.get("u-lock"),
      priorMessages,
    });
    expect(block).not.toBeNull();
    expect(block!.title).toBe("卖点定稿");
    expect(block!.selectedMessage).toBe(FASHION_LOCK_SELLPOINTS);
    expect(block!.cards).toHaveLength(2);
    expect(block!.cards.some((c) => c.message === FASHION_LOCK_SELLPOINTS)).toBe(true);
    expect(block!.cards.some((c) => c.message === FASHION_REGENERATE_SELLPOINTS)).toBe(true);
    expect(block!.cards.some((c) => c.message === FASHION_AI_POLISH_SELLPOINTS)).toBe(false);
  });

  it("replays story topic pick with full candidate cards and selection", () => {
    const topicMessage = storyTopicChoiceLabel("周末出游纠结穿搭");
    const project = baseProject({
      productionMode: "story_theater",
      sellpointsLocked: true,
      storyTopicCandidates: [
        {
          id: "t1",
          title: "周末出游纠结穿搭",
          storyCore: "出门前反复换衣",
          storyType: "场景适配",
        },
        {
          id: "t2",
          title: "通勤早高峰",
          storyCore: "赶时间也要好看",
          storyType: "痛点治愈",
        },
      ],
      selectedStoryTopic: {
        id: "t1",
        title: "周末出游纠结穿搭",
        storyCore: "出门前反复换衣",
        storyType: "场景适配",
      },
    });
    const priorMessages = [
      { id: "u-lock", role: "user" as const, content: FASHION_LOCK_SELLPOINTS, createdAt: "" },
    ];
    const labels = buildFashionWorkflowChoiceMessageLabels([
      ...priorMessages,
      { id: "u-topic", role: "user", content: topicMessage, createdAt: "" },
    ]);
    const block = buildFashionHistoricalChoiceBlock({
      userMessage: topicMessage,
      project,
      choiceMeta: labels.get("u-topic"),
      priorMessages,
    });
    expect(block).not.toBeNull();
    expect(block!.title).toBe("故事主题");
    expect(block!.selectedMessage).toBe(topicMessage);
    expect(block!.cards).toHaveLength(2);
    expect(block!.cards.some((c) => c.message === topicMessage)).toBe(true);
  });

  it("replays production mode pick with both cards", () => {
    const project = baseProject();
    const block = buildFashionHistoricalChoiceBlock({
      userMessage: PRODUCTION_MODE_STORY,
      project,
      priorMessages: [],
    });
    expect(block).not.toBeNull();
    expect(block!.title).toBe("产出模式");
    expect(block!.selectedMessage).toBe(PRODUCTION_MODE_STORY);
    expect(block!.cards).toHaveLength(2);
  });

  it("replays story theater version pick with T1–T5 cards", () => {
    const pickMessage = storyTheaterVersionChoiceLabel("T2");
    const project = baseProject({
      productionMode: "story_theater",
      sellpointsLocked: true,
      selectedStoryTopic: {
        id: "t1",
        title: "主题",
        storyCore: "核心",
        storyType: "场景适配",
      },
      storyTheaterVersions: {
        T1: { id: "T1", title: "痛点", panels: [{ index: 1 } as never] },
        T2: { id: "T2", title: "场景", panels: [{ index: 1 } as never] },
      },
    });
    const block = buildFashionHistoricalChoiceBlock({
      userMessage: pickMessage,
      project,
      priorMessages: [],
    });
    expect(block).not.toBeNull();
    expect(block!.title).toBe("故事版");
    expect(block!.cards.length).toBeGreaterThanOrEqual(2);
    expect(block!.cards.some((c) => c.message === pickMessage)).toBe(true);
  });
});
