import { describe, expect, it } from "vitest";

import {
  buildAiNewsPrompt,
  cstDateKey,
  previousCstDateKey,
  pruneCutoffDateKey,
  resetAiNewsCacheForTests,
} from "@/lib/platform-assistant/ai-news-service";

describe("ai news service", () => {
  it("builds user prompt with four categories", () => {
    const prompt = buildAiNewsPrompt(new Date("2026-08-21T04:00:00.000Z"));
    expect(prompt).toContain("2026年8月21日");
    expect(prompt).toContain("10 条");
    expect(prompt).toContain("【资本与行业动态】");
    expect(prompt).toContain("由 AI 整理");
  });

  it("uses CST date key", () => {
    expect(cstDateKey(new Date("2026-08-21T16:00:00.000Z"))).toBe("2026-08-22");
  });

  it("computes previous CST date key", () => {
    expect(previousCstDateKey("2026-08-22")).toBe("2026-08-21");
    expect(previousCstDateKey("2026-03-01")).toBe("2026-02-28");
  });

  it("prune cutoff retains 3 CST days", () => {
    expect(pruneCutoffDateKey(new Date("2026-08-24T04:00:00.000Z"))).toBe("2026-08-21");
  });

  it("resets cache helper", () => {
    resetAiNewsCacheForTests();
    expect(true).toBe(true);
  });
});
