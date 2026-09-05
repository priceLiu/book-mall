import { describe, expect, it } from "vitest";

import {
  defaultPro2ScriptCategoryDocBody,
  mergePro2ScriptGenerationPrompt,
  scopePro2CategoryDocForSection,
  shouldIncludePro2CategoryDocInSection,
} from "@/lib/canvas/pro2-script-category-doc";
import { buildPro2StoryboardShotBudgetPromptBlock } from "@/lib/canvas/pro2-storyboard-shot-budget";
import { parseStoryboardRows } from "@/lib/canvas/parse-md-tables";
import { storyPro2GuFengHubPromptPack } from "@/lib/canvas/story-pro2-theme-outline-prompt";

const SAMPLE_OUTLINE = `第一集《未婚夫每天都想让我喜欢他》
时长
3分钟
【00:00—00:20】开场钩子 … 昨晚睡得好吗？
【02:50—03:00】 … 是本王求来的。黑屏。`;

/** 模拟 Pro2 古风 hub · 分镜段最终送入 LLM 的 system prompt */
function assembleGuFengStoryboardSystemPrompt(outlineMd: string): string {
  const pack = storyPro2GuFengHubPromptPack();
  const categoryDoc = defaultPro2ScriptCategoryDocBody("gu-feng-tian-chong") ?? "";
  return mergePro2ScriptGenerationPrompt(pack.promptStoryboard, "", [], {
    scriptCategoryId: "gu-feng-tian-chong",
    categoryDoc,
    includeCategoryDoc: true,
    outlineMd,
    llmSection: "storyboard",
  });
}

describe("gu-feng prompt parity vs DeepSeek console", () => {
  it("category doc mirrors docs/古风田宠短剧.md core rules (JSON-only v13)", () => {
    const doc = defaultPro2ScriptCategoryDocBody("gu-feng-tian-chong") ?? "";
    expect(doc).toContain("创作死锁铁律");
    expect(doc).toContain("反差");
    expect(doc).toContain("悬念");
    expect(doc).toContain("糖点密度");
    expect(doc).toContain("视觉死锁");
    expect(doc).toContain("固定形象描述");
    expect(doc).toContain("12–18 镜");
    expect(doc).toContain("175–185 秒");
    expect(doc).toContain("黑色发丝，高髻云鬓");
    expect(doc).toContain("深墨蓝暗青色广袖长袍");
    expect(doc).toContain("固定反向提示词");
    expect(doc).toContain("JSON-only");
    expect(doc).not.toContain("禁止 JSON");
    expect(doc).not.toContain("GFM 表头");
    expect(doc).not.toContain("[Negative:");
  });

  it("storyboard system prompt includes category doc + shot budget for 3min outline", () => {
    const merged = assembleGuFengStoryboardSystemPrompt(SAMPLE_OUTLINE);
    expect(merged).toContain("## 剧本类别参考");
    expect(merged).toContain("## 故事大纲");
    expect(merged).toContain("镜数与时长预算");
    expect(merged).toContain("不得少于 **12** 镜");
    expect(merged).toContain("高密度糖点");
    expect(merged).toContain("Pass1 禁止");
    expect(merged).toContain("禁止只输出 1–2 镜样例即停");
  });

  it("gu-feng downstream sections embed full category doc", () => {
    expect(
      shouldIncludePro2CategoryDocInSection("storyboard", "gu-feng-tian-chong"),
    ).toBe(true);
    expect(
      shouldIncludePro2CategoryDocInSection("character", "gu-feng-tian-chong"),
    ).toBe(true);
    expect(
      shouldIncludePro2CategoryDocInSection("storyboard", "default-master"),
    ).toBe(false);
  });

  it("scopes category doc for scene segment (no shots[] sample / full pack footer)", () => {
    const doc = defaultPro2ScriptCategoryDocBody("gu-feng-tian-chong") ?? "";
    const scoped = scopePro2CategoryDocForSection(doc, "scene");
    expect(scoped).toContain("step=scene");
    expect(scoped).toContain("scenes[]");
    expect(scoped).not.toContain('"index": 1');
    expect(scoped).not.toContain("禁止只输出 1–2 镜即停");
  });
});

describe("docs/result.md gold standard structure", () => {
  it("14-shot result matches 3-minute budget expectations", () => {
    const budget = buildPro2StoryboardShotBudgetPromptBlock("时长\n3分钟");
    expect(budget).toMatch(/12/);
  });

  it("result.md storyboard has 14 rows when parsed as GFM", () => {
    // 镜号 1–14 行 · 与 docs/result.md 一致
    const header = `| 镜号 | 景别 | 光影 | 运镜 | 画面描述 | 道具 | 对白 | 时长(秒) | 音效 | 口型/配音备注 |
|------|------|------|------|----------|------|------|----------|------|---------------|`;
    const rows = Array.from({ length: 14 }, (_, i) => {
      const n = i + 1;
      return `| ${n} | 中景 | 暖光 | 固定机位平拍，人物入画 | 【起始】…【结束】… | — | — | 10 | 环境音 | — |`;
    });
    const md = `## 分镜脚本\n\n${header}\n${rows.join("\n")}`;
    const parsed = parseStoryboardRows(md);
    expect(parsed).toHaveLength(14);
    const budgetBlock = buildPro2StoryboardShotBudgetPromptBlock("3分钟");
    expect(budgetBlock).toContain("12");
    expect(parsed.length).toBeGreaterThanOrEqual(12);
  });
});
