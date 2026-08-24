import { describe, expect, it } from "vitest";

import {
  matchCuratedAssistantAnswer,
  normalizeAssistantQaText,
  qaEntryMatchesQuery,
  type PlatformAssistantQaEntryView,
} from "@/lib/platform-assistant/qa-service";

function entry(
  partial: Partial<PlatformAssistantQaEntryView> &
    Pick<PlatformAssistantQaEntryView, "question" | "answer">,
): PlatformAssistantQaEntryView {
  return {
    id: "e1",
    createdAt: new Date(),
    updatedAt: new Date(),
    enabled: true,
    sortOrder: 0,
    matchMode: "CONTAINS",
    matchKeywords: [],
    sourceFeedbackId: null,
    updatedByUserId: null,
    adminNote: null,
    ...partial,
  };
}

describe("normalizeAssistantQaText", () => {
  it("strips punctuation and whitespace", () => {
    expect(normalizeAssistantQaText("  你有几岁了？  ")).toBe("你有几岁了");
  });
});

describe("qaEntryMatchesQuery", () => {
  it("EXACT requires normalized equality", () => {
    const e = entry({
      question: "你有几岁了？",
      answer: "我还很年轻",
      matchMode: "EXACT",
    });
    expect(qaEntryMatchesQuery(e, "你有几岁了")).toBe(true);
    expect(qaEntryMatchesQuery(e, "你今年几岁了")).toBe(false);
  });

  it("CONTAINS matches substring both ways", () => {
    const e = entry({
      question: "国内有吗",
      answer: "有的",
      matchMode: "CONTAINS",
    });
    expect(qaEntryMatchesQuery(e, "这个平台国内有吗？")).toBe(true);
    expect(qaEntryMatchesQuery(e, "海外有吗")).toBe(false);
  });

  it("KEYWORDS requires all keywords", () => {
    const e = entry({
      question: "平台区域",
      answer: "…",
      matchMode: "KEYWORDS",
      matchKeywords: ["平台", "国内"],
    });
    expect(qaEntryMatchesQuery(e, "这个平台国内有吗")).toBe(true);
    expect(qaEntryMatchesQuery(e, "平台在海外吗")).toBe(false);
  });
});

describe("matchCuratedAssistantAnswer", () => {
  it("returns first enabled match by sort order", () => {
    const rows = [
      entry({ question: "年龄", answer: "A", sortOrder: 1 }),
      entry({ question: "你有几岁了", answer: "B", sortOrder: 10 }),
    ];
    expect(matchCuratedAssistantAnswer("你有几岁了？", rows)).toBe("B");
  });

  it("skips disabled entries", () => {
    const rows = [
      entry({ question: "你有几岁了", answer: "B", enabled: false }),
    ];
    expect(matchCuratedAssistantAnswer("你有几岁了？", rows)).toBeNull();
  });

  it("never matches sensitive pricing topics", () => {
    const rows = [
      entry({ question: "订阅多少钱", answer: "99 元", matchMode: "EXACT" }),
    ];
    expect(matchCuratedAssistantAnswer("订阅多少钱", rows)).toBeNull();
  });
});
