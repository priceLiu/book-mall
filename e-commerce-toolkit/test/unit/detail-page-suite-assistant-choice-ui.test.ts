import { describe, expect, it } from "vitest";

import {
  buildDetailPageSuiteProductRefAutoAdvance,
  buildSuiteHistoricalChoiceBlock,
  reconcileDetailPageSuiteProductRefState,
  resolveSuiteAssistantSelectedMessage,
  resolveSuiteLiveChoiceStep,
  resolveSuiteWorkspaceGuide,
  SUITE_PRODUCT_REF_ACK,
} from "@/lib/detail-page-suite-assistant-choice-ui";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import { buildFashionDimensionMessageLabels } from "@/lib/fashion-dimensions";

describe("buildSuiteHistoricalChoiceBlock", () => {
  it("renders read-only product ref pick", () => {
    const block = buildSuiteHistoricalChoiceBlock({
      userMessage: "已上传产品图",
    });
    expect(block?.title).toBe("已选 · 产品图");
    expect(block?.selectedMessage).toBe("已上传产品图");
    expect(block?.cards.length).toBe(2);
  });

  it("renders read-only dimension pick with full option list", () => {
    const messages = [
      { id: "u1", role: "user" as const, content: "女装", createdAt: "" },
    ];
    const labels = buildFashionDimensionMessageLabels(messages);
    const block = buildSuiteHistoricalChoiceBlock({
      userMessage: "女装",
      dimMeta: labels.get("u1"),
    });
    expect(block?.title).toBe("已选 · 性别品类");
    expect(block?.selectedMessage).toBe("女装");
    expect(block?.cards.some((c) => c.title === "女装")).toBe(true);
  });
});

describe("buildDetailPageSuiteProductRefAutoAdvance", () => {
  const base = (): DetailPageSuiteProject => ({
    id: "p1",
    title: "t",
    module: "detail-page-suite",
    status: "draft",
    brief: null,
    settings: {},
    references: [{ id: "r1", label: "产品图", role: "product", ossUrl: "https://x" }],
    chatHistory: [],
    suite: { modules: [] },
    meta: { phase: "product_ref" },
    createdAt: "",
    updatedAt: "",
  });

  it("advances to dimensions with chat ack", () => {
    const patch = buildDetailPageSuiteProductRefAutoAdvance(base());
    expect(patch?.meta.phase).toBe("dimensions");
    expect(patch?.chatHistory.some((m) => m.content === SUITE_PRODUCT_REF_ACK)).toBe(true);
    expect(patch?.chatHistory.some((m) => m.content.includes("七维"))).toBe(true);
  });

  it("returns null when already past product_ref", () => {
    expect(
      buildDetailPageSuiteProductRefAutoAdvance({
        ...base(),
        meta: { phase: "dimensions", dimensionStep: 0 },
      }),
    ).toBeNull();
  });
});

describe("resolveSuiteAssistantSelectedMessage", () => {
  const base = (): DetailPageSuiteProject => ({
    id: "p1",
    title: "t",
    module: "detail-page-suite",
    status: "draft",
    brief: null,
    settings: {},
    references: [],
    chatHistory: [],
    suite: { modules: [] },
    meta: { phase: "product_ref" },
    createdAt: "",
    updatedAt: "",
  });

  it("does not auto-select ack from refs alone", () => {
    const project = {
      ...base(),
      references: [{ id: "r1", label: "产品图", role: "product" as const, ossUrl: "https://x" }],
    };
    expect(resolveSuiteAssistantSelectedMessage(project)).toBeNull();
  });

  it("selects ack when chat records upload and refs exist", () => {
    const project = {
      ...base(),
      references: [{ id: "r1", label: "产品图", role: "product" as const, ossUrl: "https://x" }],
      chatHistory: [
        {
          id: "u1",
          role: "user" as const,
          content: SUITE_PRODUCT_REF_ACK,
          createdAt: "",
        },
      ],
    };
    expect(resolveSuiteAssistantSelectedMessage(project)).toBe(SUITE_PRODUCT_REF_ACK);
  });

  it("returns null when no refs and no prior choice", () => {
    expect(resolveSuiteAssistantSelectedMessage(base())).toBeNull();
  });

  it("ignores stale ack in chat when refs are missing", () => {
    const project = {
      ...base(),
      chatHistory: [
        {
          id: "user-auto-ref-1",
          role: "user" as const,
          content: SUITE_PRODUCT_REF_ACK,
          createdAt: "",
        },
      ],
    };
    expect(resolveSuiteAssistantSelectedMessage(project)).toBeNull();
  });
});

describe("reconcileDetailPageSuiteProductRefState", () => {
  const base = (): DetailPageSuiteProject => ({
    id: "p1",
    title: "t",
    module: "detail-page-suite",
    status: "draft",
    brief: null,
    settings: {},
    references: [],
    chatHistory: [],
    suite: { modules: [] },
    meta: { phase: "product_ref" },
    createdAt: "",
    updatedAt: "",
  });

  it("strips stale ack messages when no valid refs", () => {
    const project = {
      ...base(),
      chatHistory: [
        {
          id: "user-auto-ref-1",
          role: "user" as const,
          content: SUITE_PRODUCT_REF_ACK,
          createdAt: "",
        },
        {
          id: "assistant-auto-ref-1",
          role: "assistant" as const,
          content: "已检测到产品图，接下来请选择七维参数。",
          createdAt: "",
        },
      ],
    };
    const patch = reconcileDetailPageSuiteProductRefState(project);
    expect(patch?.chatHistory).toEqual([]);
  });

  it("returns null when refs exist", () => {
    const project = {
      ...base(),
      references: [{ id: "r1", label: "产品图", role: "product" as const, ossUrl: "https://x" }],
      chatHistory: [
        {
          id: "u1",
          role: "user" as const,
          content: SUITE_PRODUCT_REF_ACK,
          createdAt: "",
        },
      ],
    };
    expect(reconcileDetailPageSuiteProductRefState(project)).toBeNull();
  });
});

describe("resolveSuiteWorkspaceGuide", () => {
  it("guides center-panel workflow after modules", () => {
    expect(resolveSuiteWorkspaceGuide("subdims")?.title).toBe("中栏编排");
    expect(resolveSuiteWorkspaceGuide("prompts")?.body).toContain("中栏");
    expect(resolveSuiteWorkspaceGuide("images")).toBeNull();
  });
});

describe("resolveSuiteLiveChoiceStep", () => {
  it("does not show subdims/prompts cards in assistant", () => {
    expect(
      resolveSuiteLiveChoiceStep({
        phase: "subdims",
        dimStep: 0,
        templates: [],
        hasProductRefs: false,
        hasSellPoints: false,
      }),
    ).toBeNull();
    expect(
      resolveSuiteLiveChoiceStep({
        phase: "prompts",
        dimStep: 0,
        templates: [],
        hasProductRefs: false,
        hasSellPoints: false,
      }),
    ).toBeNull();
  });

  it("mentions detected refs in product_ref subtitle", () => {
    const step = resolveSuiteLiveChoiceStep({
      phase: "product_ref",
      dimStep: 0,
      templates: [],
      hasProductRefs: true,
      hasSellPoints: false,
    });
    expect(step?.subtitle).toContain("自动进入七维");
  });

  it("includes progress for dimension step", () => {
    const step = resolveSuiteLiveChoiceStep({
      phase: "dimensions",
      dimStep: 1,
      templates: [],
      hasProductRefs: false,
      hasSellPoints: false,
    });
    expect(step?.progress).toBe("2/7");
    expect(step?.choices.some((c) => c.title === "T恤")).toBe(true);
  });
});
