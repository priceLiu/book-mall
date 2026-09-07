import { describe, expect, it } from "vitest";

import { buildFashionHistoricalChoiceBlock } from "@/lib/fashion-assistant-choice-ui";
import { buildFashionDimensionMessageLabels } from "@/lib/fashion-dimensions";
import { FASHION_CUSTOM_DIMENSION_CHOICE } from "@/lib/fashion-workflow";
import type { StoryboardProject } from "@/lib/storyboard-types";

function baseProject(): StoryboardProject {
  return {
    id: "proj-1",
    title: "测试项目",
    chatHistory: [],
    meta: {
      deliverable: {
        schemaVersion: "fashion-v4",
        vertical: "fashion_apparel",
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
});
