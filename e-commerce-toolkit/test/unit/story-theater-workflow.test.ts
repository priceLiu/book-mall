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
import {
  FASHION_GENERATE_STORY_THEATER,
  FASHION_REGENERATE_STORY_THEATER,
  FASHION_RELOAD_STORY_TOPICS,
  fashionLlmStreamIdleTimeoutMs,
  fashionLlmStreamTimeoutMs,
  fashionWorkflowPatchForChoice,
  inferFashionChoices,
  inferFashionPhaseFromState,
  isAwaitingStoryTheaterVersionsPending,
} from "@/lib/fashion-workflow";
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

  it("gives story-theater a longer idle and total stream budget than default chat", () => {
    expect(fashionLlmStreamIdleTimeoutMs("fashion-step:story-theater-generate")).toBe(
      4 * 60_000,
    );
    expect(fashionLlmStreamTimeoutMs("fashion-step:story-theater-generate")).toBe(12 * 60_000);
    expect(fashionLlmStreamIdleTimeoutMs("fashion-step:sellpoints-generate")).toBe(2 * 60_000);
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

describe("inferFashionChoices · story theater stuck recovery", () => {
  const topic = {
    id: "t1",
    title: "周末出游纠结穿搭不好搭配",
    storyCore: "出门前反复换衣",
    storyType: "场景适配",
  };

  function storyLineProject(
    deliverable: Record<string, unknown>,
    chatHistory: StoryboardProject["chatHistory"] = [],
  ): StoryboardProject {
    return {
      id: "p1",
      title: "test",
      status: "draft",
      chatHistory,
      references: [{ id: "r1", role: "product", url: "https://x/y.png", label: "产品" }],
      meta: {
        workflow: {
          vertical: "fashion_apparel",
          fashionPhase: "story_topic_pick",
        },
        deliverable: {
          schemaVersion: "fashion-v4",
          vertical: "fashion_apparel",
          productName: "裙",
          productionMode: "story_theater",
          sellpoints: [{ id: "S01", text: "显瘦", layer: "core", source: "ai" }],
          sellpointsLocked: true,
          ...deliverable,
        },
      },
    };
  }

  it("offers regenerate when topic is selected but T1–T5 never arrived", () => {
    const project = storyLineProject(
      {
        selectedStoryTopic: topic,
        storyTopicCandidates: [topic],
        storyTheaterVersions: {},
      },
      [
        {
          id: "u1",
          role: "user",
          content: storyTopicChoiceLabel(topic.title),
          createdAt: "",
        },
      ],
    );
    expect(isAwaitingStoryTheaterVersionsPending(project)).toBe(true);
    const choices = inferFashionChoices(project);
    expect(choices.some((c) => c.message === FASHION_REGENERATE_STORY_THEATER)).toBe(true);
  });

  it("offers generate when topic is selected without a prior request", () => {
    const project = storyLineProject({
      selectedStoryTopic: topic,
      storyTopicCandidates: [topic],
      storyTheaterVersions: {},
    });
    const choices = inferFashionChoices(project);
    expect(
      choices.some(
        (c) =>
          c.message === FASHION_GENERATE_STORY_THEATER ||
          c.message === FASHION_REGENERATE_STORY_THEATER,
      ),
    ).toBe(true);
  });

  it("offers reload when awaiting topic pick but candidates are empty", () => {
    const project = storyLineProject({
      selectedStoryTopic: null,
      storyTopicCandidates: [],
    });
    const choices = inferFashionChoices(project);
    expect(choices.some((c) => c.message === FASHION_RELOAD_STORY_TOPICS)).toBe(true);
  });

  it("generate and regenerate story theater both trigger LLM while keeping the selected topic", () => {
    const project = storyLineProject({
      selectedStoryTopic: topic,
      storyTopicCandidates: [topic],
      storyTheaterVersions: {},
    });
    for (const message of [FASHION_GENERATE_STORY_THEATER, FASHION_REGENERATE_STORY_THEATER]) {
      const patch = fashionWorkflowPatchForChoice(project, message);
      expect(patch).not.toBeNull();
      expect(patch).toHaveProperty("llmTrigger");
      expect((patch as { deliverable: { selectedStoryTopic?: { title: string } } }).deliverable.selectedStoryTopic?.title).toBe(
        topic.title,
      );
    }
  });
});
