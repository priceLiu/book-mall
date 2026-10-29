import { describe, expect, it } from "vitest";

import {
  organizeAiNewsMarkdown,
  previewAiNewsMarkdown,
} from "../../../shared/platform-assistant/ai-news-format";
import {
  buildAiNewsPrompt,
  cstDateKey,
  previousCstDateKey,
  pruneCutoffDateKey,
  resetAiNewsCacheForTests,
} from "@/lib/platform-assistant/ai-news-service";

describe("ai news service", () => {
  it("builds user prompt with model releases first", () => {
    const prompt = buildAiNewsPrompt(new Date("2026-08-21T04:00:00.000Z"));
    expect(prompt).toContain("2026年8月21日");
    expect(prompt).toContain("10 条");
    expect(prompt).toContain("【模型发布】");
    expect(prompt.indexOf("【模型发布】")).toBeLessThan(prompt.indexOf("【资本与行业动态】"));
    expect(prompt).toContain("没有把握就整段省略");
    expect(prompt).toContain("由 AI 整理");
    expect(prompt).toContain("出处");
    expect(prompt).toContain("发表时间");
    expect(prompt).toContain("2026年8月21日 AI 热闻");
  });

  it("lifts model launches to the front and keeps them in the preview", () => {
    const raw = [
      "📰 2026年8月21日 AI 热闻",
      "",
      "【资本与行业动态】",
      "1. **某公司完成融资**",
      "核心事实：完成一轮融资",
      "",
      "【技术前沿与争议】",
      "2. **学术争议持续**",
      "核心事实：论文方法受到质疑",
      "3. **OpenAI 发布 GPT-5**",
      "核心事实：正式上线新模型",
      "出处：OpenAI",
      "*以上内容由 AI 整理，时效性与事实请以权威来源为准。*",
    ].join("\n");

    const organized = organizeAiNewsMarkdown(raw);
    expect(organized.indexOf("【模型发布】")).toBeLessThan(organized.indexOf("【资本与行业动态】"));
    expect(organized).toContain("1. **OpenAI 发布 GPT-5**");
    expect(organized).not.toContain("3. **OpenAI 发布 GPT-5**");
    expect(organized.indexOf("由 AI 整理")).toBeGreaterThan(organized.indexOf("【技术前沿与争议】"));

    const preview = previewAiNewsMarkdown(raw, 3);
    expect(preview).toContain("OpenAI 发布 GPT-5");
    expect(countItems(preview)).toBe(3);
  });

  it("does not invent a model section when nothing was released", () => {
    const raw = ["【资本与行业动态】", "1. **某公司完成融资**", "核心事实：完成一轮融资"].join("\n");
    expect(organizeAiNewsMarkdown(raw)).not.toContain("【模型发布】");
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

function countItems(text: string): number {
  return text.split("\n").filter((line) => /^\s*\d+\.\s/.test(line)).length;
}
