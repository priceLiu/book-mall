import { describe, expect, it } from "vitest";

import {
  buildProductDesignArchivedAssistantChoiceBlock,
  buildProductDesignHistoricalChoiceBlock,
  parseProductDesignAssistantEmbeddedChoices,
  resolveProductDesignAssistantChoiceStep,
} from "@/lib/product-design-assistant-choice-ui";
import {
  INTERACTIVE_WORKFLOW_CHOICE,
  MAIN_REF_PROMPT_WORKFLOW_CHOICE,
  PLATFORM_CHOICE_PREFIX,
} from "@/lib/product-design-workflow";
import type { ProductDesignProject } from "@/lib/product-design-types";

const specs = [
  {
    code: "taobao",
    label: "淘宝",
    mainImage: { min: 1, max: 10, recommended: 5 },
    detailPage: { min: 5, max: 20, recommended: 8 },
  },
] as const;

function baseProject(overrides: Partial<ProductDesignProject> = {}): ProductDesignProject {
  return {
    id: "p1",
    title: "测试",
    module: "product-design",
    platform: "taobao",
    track: "main",
    status: "draft",
    settings: {},
    references: [
      {
        id: "r1",
        role: "product",
        ossUrl: "https://example.com/p.jpg",
        label: "产品",
      },
    ],
    brief: {},
    design: null,
    resolved: { mainImageCount: 5, detailPageCount: 8 },
    chatHistory: [],
    meta: { setupPhase: "workflow-choice" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as ProductDesignProject;
}

describe("product-design-assistant-choice-ui", () => {
  it("builds workflow historical block with both cards and selection", () => {
    const block = buildProductDesignHistoricalChoiceBlock(
      INTERACTIVE_WORKFLOW_CHOICE,
      baseProject(),
      specs as never,
    );
    expect(block?.title).toBe("已选 · 主图制作方式");
    expect(block?.selectedMessage).toBe(INTERACTIVE_WORKFLOW_CHOICE);
    expect(block?.cards.map((c) => c.message)).toEqual([
      INTERACTIVE_WORKFLOW_CHOICE,
      MAIN_REF_PROMPT_WORKFLOW_CHOICE,
    ]);
  });

  it("resolves workflow choice step", () => {
    const step = resolveProductDesignAssistantChoiceStep(baseProject(), specs as never);
    expect(step?.title).toBe("选择主图制作方式");
  });

  it("builds platform historical block", () => {
    const message = `${PLATFORM_CHOICE_PREFIX}淘宝`;
    const block = buildProductDesignHistoricalChoiceBlock(
      message,
      baseProject({ meta: { setupPhase: "done", platformConfirmed: true } }),
      specs as never,
    );
    expect(block?.title).toBe("已选 · 上架平台");
    expect(block?.cards.some((c) => c.message === message)).toBe(true);
  });

  it("parses legacy assistant bullet workflow prompt", () => {
    const content = `已上传主图风格参考。请点选下方主图制作方式：\n· ${INTERACTIVE_WORKFLOW_CHOICE}\n· ${MAIN_REF_PROMPT_WORKFLOW_CHOICE}`;
    const parsed = parseProductDesignAssistantEmbeddedChoices(content);
    expect(parsed?.choiceMessages).toEqual([
      INTERACTIVE_WORKFLOW_CHOICE,
      MAIN_REF_PROMPT_WORKFLOW_CHOICE,
    ]);
  });

  it("archives assistant prompt with selection from following user message", () => {
    const content = `已上传主图风格参考。请点选下方主图制作方式：\n· ${INTERACTIVE_WORKFLOW_CHOICE}\n· ${MAIN_REF_PROMPT_WORKFLOW_CHOICE}`;
    const messages = [
      { id: "a1", role: "assistant" as const, content, createdAt: "" },
      {
        id: "u1",
        role: "user" as const,
        content: MAIN_REF_PROMPT_WORKFLOW_CHOICE,
        createdAt: "",
      },
    ];
    const block = buildProductDesignArchivedAssistantChoiceBlock(content, messages, 0);
    expect(block).toBeNull();
  });

  it("only keeps latest pending workflow prompt when uploads repeat", () => {
    const content = `已上传主图风格参考。请点选下方主图制作方式：\n· ${INTERACTIVE_WORKFLOW_CHOICE}\n· ${MAIN_REF_PROMPT_WORKFLOW_CHOICE}`;
    const messages = [
      { id: "a1", role: "assistant" as const, content, createdAt: "" },
      { id: "a2", role: "assistant" as const, content, createdAt: "" },
    ];
    expect(buildProductDesignArchivedAssistantChoiceBlock(content, messages, 0)).toBeNull();
    expect(buildProductDesignArchivedAssistantChoiceBlock(content, messages, 1)).not.toBeNull();
  });
});
