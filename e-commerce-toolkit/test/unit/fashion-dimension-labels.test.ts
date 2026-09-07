import { describe, expect, it } from "vitest";

import { buildFashionHistoricalChoiceBlock } from "@/lib/fashion-assistant-choice-ui";
import {
  buildFashionDimensionMessageLabels,
  buildFashionDimensionsFromChat,
} from "@/lib/fashion-dimensions";
import { buildFashionWorkflowChoiceMessageLabels } from "@/lib/fashion-workflow";
import { proCategoryChoiceLabel } from "@/lib/pro-vertical/categories";
import type { StoryboardProject } from "@/lib/storyboard-types";

describe("fashion dimension message labels · pro category pick", () => {
  it("skips category pick before mapping fashion dimension steps", () => {
    const messages = [
      { id: "u0", role: "user", content: proCategoryChoiceLabel("服装") },
      { id: "u1", role: "user", content: "女装" },
      { id: "u2", role: "user", content: "T恤" },
    ];
    const labels = buildFashionDimensionMessageLabels(messages);
    expect(labels.has("u0")).toBe(false);
    expect(labels.get("u1")).toMatchObject({ label: "性别品类", progress: "1/7" });
    expect(labels.get("u2")).toMatchObject({ label: "款式品类", progress: "2/7" });
  });

  it("builds dimensions from chat without consuming category pick as genderCategory", () => {
    const messages = [
      { role: "user", content: proCategoryChoiceLabel("服装") },
      { role: "user", content: "女装" },
      { role: "user", content: "T恤" },
    ];
    const dims = buildFashionDimensionsFromChat(messages);
    expect(dims.genderCategory).toBe("女装");
    expect(dims.styleCategory).toBe("T恤");
  });

  it("replays category pick as workflow cards, not gender dimension cards", () => {
    const categoryMessage = proCategoryChoiceLabel("服装");
    const project = {
      id: "p1",
      title: "test",
      chatHistory: [],
      references: [{ id: "r1", role: "product", url: "https://x/y.png", label: "产品" }],
      meta: {
        workflow: { proMode: true, vertical: "fashion_apparel", fashionPhase: "dimensions" },
        deliverable: { schemaVersion: "fashion-v4", vertical: "fashion_apparel" },
      },
    } as unknown as StoryboardProject;
    const labels = buildFashionWorkflowChoiceMessageLabels([
      { id: "u0", role: "user", content: categoryMessage },
    ]);
    const block = buildFashionHistoricalChoiceBlock({
      userMessage: categoryMessage,
      project,
      choiceMeta: labels.get("u0"),
      priorMessages: [],
    });
    expect(block).not.toBeNull();
    expect(block!.title).toBe("选择大类品类");
    expect(block!.selectedMessage).toBe(categoryMessage);
    expect(block!.cards.some((c) => c.message === categoryMessage)).toBe(true);
    expect(block!.cards.some((c) => c.title === "男装")).toBe(false);
  });
});
