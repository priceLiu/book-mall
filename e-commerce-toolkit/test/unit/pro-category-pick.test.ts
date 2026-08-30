import { describe, expect, it } from "vitest";

import {
  buildFashionProductRefAutoAdvance,
  inferFashionChoices,
  isAwaitingProCategoryPick,
} from "@/lib/fashion-workflow";
import { PRO_CATEGORY_OPTIONS, parseProCategoryPick, proCategoryChoiceLabel } from "@/lib/pro-vertical/categories";
import type { StoryboardProject } from "@/lib/storyboard-types";

function proDraftProject(hasProduct = false): StoryboardProject {
  return {
    id: "p1",
    title: "电商专业版",
    module: "storyboard",
    status: "draft",
    brief: null,
    settings: null,
    references: hasProduct
      ? [{ id: "r1", role: "product", label: "产品", ossUrl: "https://example.com/p.jpg" }]
      : [],
    chatHistory: [],
    sheet: null,
    sheetPngUrl: null,
    sheetHtmlUrl: null,
    videoAssetId: null,
    meta: {
      workflow: { proMode: true, proPhase: "product_ref", dimensionStep: 0 },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as StoryboardProject;
}

describe("pro category pick flow", () => {
  it("shows five category choices after product upload without vertical", () => {
    const project = proDraftProject(true);
    expect(isAwaitingProCategoryPick(project)).toBe(true);
    const choices = inferFashionChoices(project);
    expect(choices).toHaveLength(PRO_CATEGORY_OPTIONS.length);
    expect(choices.map((c) => c.title)).toContain("服装");
    expect(choices.map((c) => c.title)).toContain("3C 数码");
  });

  it("product ref auto advance enters category_pick not dimensions", () => {
    const advance = buildFashionProductRefAutoAdvance(proDraftProject(true));
    expect(advance.workflow.proPhase).toBe("category_pick");
    expect(advance.workflow.vertical).toBeUndefined();
    expect(advance.chatHistory?.some((m) => m.content.includes("选择大类品类"))).toBe(true);
  });

  it("parses category choice labels", () => {
    expect(parseProCategoryPick(proCategoryChoiceLabel("包包"))?.verticalId).toBe("bags");
  });
});
