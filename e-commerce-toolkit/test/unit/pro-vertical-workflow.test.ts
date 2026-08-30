import { describe, expect, it } from "vitest";

import { buildProDimensionsFromChat, resolveDimensionStepOptions } from "@/lib/pro-vertical/dimensions";
import { getProVerticalConfig } from "@/lib/pro-vertical/registry";
import { getProjectVertical } from "@/lib/pro-vertical/project-vertical";
import {
  fashionLlmTriggerSucceeded,
  inferFashionChoices,
  FASHION_LOCK_SELLPOINTS,
  FASHION_CONFIRM_STORYBOARD,
  isAwaitingFashionStoryboardPick,
  isAwaitingFashionStoryboardConfirm,
  resolveProVerticalDeliverable,
} from "@/lib/fashion-workflow";
import type { StoryboardProject } from "@/lib/storyboard-types";

function bagProject(chatHistory: StoryboardProject["chatHistory"]): StoryboardProject {
  return {
    id: "p1",
    title: "包包专业版",
    module: "storyboard",
    status: "draft",
    brief: null,
    settings: null,
    references: [],
    chatHistory,
    sheet: null,
    sheetPngUrl: null,
    sheetHtmlUrl: null,
    videoAssetId: null,
    meta: {
      workflow: { vertical: "bags", proPhase: "dimensions", dimensionStep: 2 },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("pro-vertical workflow · bags dimensions", () => {
  it("bags config exposes 17 bag types and gender options", () => {
    const config = getProVerticalConfig("bags");
    expect(config?.label).toBe("包包专业版");
    expect(config?.panelFocusLabel).toBe("包包展示重点");
    expect(config?.dimensionSteps[0]?.label).toBe("性别定位");
    expect(config?.dimensionSteps[1]?.options).toContain("托特包");
    expect(config?.dimensionSteps[1]?.options).toHaveLength(16);
  });

  it("getProjectVertical reads bags from workflow meta", () => {
    const project = bagProject([]);
    expect(getProjectVertical(project)).toBe("bags");
  });

  it("buildProDimensionsFromChat merges assistant dimension picks", () => {
    const dims = buildProDimensionsFromChat("bags", [
      { role: "assistant", content: "请选择性别定位：\n- 女包\n- 男包" },
      { role: "user", content: "女包" },
      { role: "assistant", content: "请选择包型品类：\n- 托特包\n- 斜挎包" },
      { role: "user", content: "托特包" },
    ]);
    expect(dims.genderCategory).toBe("女包");
    expect(dims.styleCategory).toBe("托特包");
  });
});

describe("pro-vertical workflow · digital_3c dimensions", () => {
  it("digital_3c config exposes searchable category steps and subOptions", () => {
    const config = getProVerticalConfig("digital_3c");
    expect(config?.label).toBe("3C数码专业版");
    expect(config?.panelFocusLabel).toBe("产品展示重点");
    expect(config?.characterRefPolicy).toBe("optional");
    expect(config?.dimensionSteps).toHaveLength(7);
    expect(config?.dimensionSteps[0]?.ui).toBe("searchSelect");
    expect(config?.dimensionSteps[0]?.key).toBe("productCategory");
    expect(config?.dimensionSteps[1]?.parentKey).toBe("productCategory");
    expect(config?.dimensionSteps[1]?.subOptionsMap?.手机).toContain("旗舰机");
  });

  it("resolveDimensionStepOptions filters sub category by parent", () => {
    const config = getProVerticalConfig("digital_3c")!;
    const subStep = config.dimensionSteps[1]!;
    const opts = resolveDimensionStepOptions("digital_3c", subStep, { productCategory: "手机" });
    expect(opts).toContain("旗舰机");
    expect(opts).not.toContain("游戏本");
  });
});

describe("pro-vertical · LLM trigger success check", () => {
  function digital3cProject(
    deliverable: NonNullable<StoryboardProject["meta"]>["deliverable"],
  ): StoryboardProject {
    return {
      id: "p3c",
      title: "3C数码专业版",
      module: "storyboard",
      status: "deliverable_ready",
      brief: null,
      settings: null,
      references: [
        { id: "p1", role: "product", label: "产品", ossUrl: "https://example.com/p.jpg" },
      ],
      chatHistory: [],
      sheet: null,
      sheetPngUrl: null,
      sheetHtmlUrl: null,
      videoAssetId: null,
      meta: {
        workflow: { vertical: "digital_3c", proPhase: "sellpoints" },
        deliverable,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it("sellpoints trigger succeeds when pro-v1 deliverable has sellpoints", () => {
    const project = digital3cProject({
      schemaVersion: "pro-v1",
      vertical: "digital_3c",
      productName: "测试耳机",
      dimensions: {
        productCategory: "耳机",
        productSubCategory: "降噪耳机",
        outputLanguage: "中文",
      },
      sellpoints: [{ id: "S01", text: "主动降噪", layer: "core", source: "ai" }],
      sellpointsLocked: false,
      voiceovers: [],
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      outputMode: null,
    });
    expect(fashionLlmTriggerSucceeded("pro-step:sellpoints-generate", project)).toBe(true);
  });

  it("sellpoints trigger fails when pro deliverable has no sellpoints", () => {
    const project = digital3cProject({
      schemaVersion: "pro-v1",
      vertical: "digital_3c",
      productName: "测试耳机",
      dimensions: { productCategory: "耳机", outputLanguage: "中文" },
      sellpoints: [],
      sellpointsLocked: false,
      voiceovers: [],
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      outputMode: null,
    });
    expect(fashionLlmTriggerSucceeded("pro-step:sellpoints-generate", project)).toBe(false);
  });

  it("shows lock-sellpoints choice after pro sellpoints generated", () => {
    const project = digital3cProject({
      schemaVersion: "pro-v1",
      vertical: "digital_3c",
      productName: "测试手机",
      dimensions: {
        productCategory: "手机",
        productSubCategory: "旗舰机",
        designLanguage: "极简科技",
        tier: "高端旗舰",
        customScene: "通勤",
        platform: "淘宝",
        outputLanguage: "中文",
      },
      sellpoints: [
        { id: "S01", text: "旗舰芯片", layer: "core", source: "ai" },
        { id: "S02", text: "2K 屏", layer: "visual", source: "ai" },
      ],
      sellpointsLocked: false,
      voiceovers: [],
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      outputMode: null,
    });
    const choices = inferFashionChoices(project);
    expect(choices.some((c) => c.message === FASHION_LOCK_SELLPOINTS)).toBe(true);
  });
});

describe("pro-vertical · storyboard version pick", () => {
  const storyboardVersions = {
    A: {
      id: "A",
      title: "开箱惊艳版",
      panels: [
        {
          index: 1,
          shotScale: "全景",
          durationSec: 5,
          cameraMove: "缓推",
          sceneDesc: "开箱场景",
          imagePrompt: "phone unboxing",
          videoPrompt: "slow push in",
        },
      ],
    },
    B: { id: "B", title: "B版", panels: [{ index: 1, shotScale: "中景", durationSec: 4, cameraMove: "固定", sceneDesc: "展示" }] },
  };

  function digital3cStoryboardProject(
    chatHistory: StoryboardProject["chatHistory"],
    metaOverrides?: Partial<NonNullable<StoryboardProject["meta"]>>,
  ): StoryboardProject {
    return {
      id: "p3c-sb",
      title: "3C数码专业版",
      module: "storyboard",
      status: "deliverable_ready",
      brief: null,
      settings: null,
      references: [
        { id: "p1", role: "product", label: "产品", ossUrl: "https://example.com/p.jpg" },
      ],
      chatHistory,
      sheet: null,
      sheetPngUrl: null,
      sheetHtmlUrl: null,
      videoAssetId: null,
      meta: {
        workflow: { vertical: "digital_3c", proPhase: "storyboard_confirm" },
        deliverable: {
          schemaVersion: "pro-v1",
          vertical: "digital_3c",
          productName: "测试手机",
          dimensions: { productCategory: "手机", outputLanguage: "中文" },
          sellpoints: [{ id: "S01", text: "旗舰芯片", layer: "core", source: "ai" }],
          sellpointsLocked: true,
          voiceovers: [{ id: "V01", type: "口播1", narrative: "叙事" }],
          selectedVoiceoverId: "V01",
          storyboardVersions,
          selectedVersion: "A",
          storyboardLocked: false,
          coverageChecklist: [],
          outputMode: null,
        },
        ...metaOverrides,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it("advances to storyboard confirm after user picks version A", () => {
    const assistantFence = `\`\`\`pro-deliverable\n${JSON.stringify({
      schemaVersion: "pro-v1",
      vertical: "digital_3c",
      productName: "测试手机",
      sellpointsLocked: true,
      selectedVoiceoverId: "V01",
      storyboardVersions,
      selectedVersion: null,
    })}\n\`\`\``;
    const project = digital3cStoryboardProject([
      { id: "a1", role: "assistant", content: assistantFence },
      { id: "u1", role: "user", content: "选择分镜 A版：开箱惊艳版" },
    ]);

    const resolved = resolveProVerticalDeliverable(project);
    expect(resolved?.selectedVersion).toBe("A");
    expect(isAwaitingFashionStoryboardPick(project)).toBe(false);
    expect(isAwaitingFashionStoryboardConfirm(project)).toBe(true);

    const choices = inferFashionChoices(project);
    expect(choices.some((c) => c.message === FASHION_CONFIRM_STORYBOARD)).toBe(true);
    expect(choices.some((c) => c.message.startsWith("选择分镜"))).toBe(false);
  });
});
