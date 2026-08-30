import { describe, expect, it } from "vitest";

import { buildProDimensionsFromChat } from "@/lib/pro-vertical/dimensions";
import { getProVerticalConfig } from "@/lib/pro-vertical/registry";
import { getProjectVertical } from "@/lib/pro-vertical/project-vertical";
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
