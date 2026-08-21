import { describe, expect, it } from "vitest";

import {
  classifyUserFeedbackCategory,
  isUnansweredAssistantReply,
  shouldLogUnansweredQuestion,
} from "@/lib/platform-assistant/feedback-classifier";
import {
  isPlatformOverviewIntent,
  listAllPlatformAppLinks,
} from "@/lib/platform-assistant/redirect-map";

describe("platform overview intent", () => {
  it("matches platform feature questions", () => {
    expect(isPlatformOverviewIntent("平台有哪些应用")).toBe(true);
    expect(isPlatformOverviewIntent("你们有什么功能")).toBe(true);
    expect(isPlatformOverviewIntent("平台能做什么")).toBe(true);
  });

  it("lists all major apps with urls", () => {
    const links = listAllPlatformAppLinks();
    expect(links.length).toBeGreaterThanOrEqual(8);
    expect(links.some((l) => l.app === "canvas")).toBe(true);
    expect(links.every((l) => l.url.startsWith("https://"))).toBe(true);
  });
});

describe("feedback classifier", () => {
  it("detects bug reports", () => {
    expect(classifyUserFeedbackCategory("画布生成一直报错 500")).toBe("BUG");
  });

  it("detects unanswered replies", () => {
    expect(isUnansweredAssistantReply("暂未收录该信息")).toBe(true);
  });

  it("logs questions without knowledge", () => {
    expect(
      shouldLogUnansweredQuestion({
        query: "怎么导出 PSD？",
        chunkCount: 0,
        isOverview: false,
        isGreeting: false,
        assistantReply: "可以在画布中…",
      }),
    ).toBe(true);
  });
});
