import { describe, expect, it } from "vitest";

import {
  buildPro2StoryboardShotBudgetPromptBlock,
  extractTargetDurationSecondsFromOutline,
  resolvePro2StoryboardShotBudget,
  storyboardMeetsMinimumShotCount,
} from "@/lib/canvas/pro2-storyboard-shot-budget";
import { hubSectionNeedsRun } from "@/lib/canvas/story-hub-runtime";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("extractTargetDurationSecondsFromOutline", () => {
  it("parses 预计时长 table cell", () => {
    const md = `| 项目 | 内容 |
|------|------|
| 预计时长 | 3分钟 |`;
    expect(extractTargetDurationSecondsFromOutline(md)).toBe(180);
  });

  it("parses 1分30秒", () => {
    expect(
      extractTargetDurationSecondsFromOutline("单集标准时长：1分30秒"),
    ).toBe(90);
  });

  it("parses range 3-5分钟 using lower bound", () => {
    expect(extractTargetDurationSecondsFromOutline("时长 3-5分钟/集")).toBe(180);
  });
});

describe("resolvePro2StoryboardShotBudget", () => {
  it("3 minutes → at least 12 shots at 15s per shot", () => {
    const b = resolvePro2StoryboardShotBudget("预计时长 | 3分钟");
    expect(b.targetDurationSec).toBe(180);
    expect(b.minShots).toBe(12);
    expect(b.maxShots).toBeGreaterThanOrEqual(12);
  });

  it("prompt block forbids stopping at 1-2 shots", () => {
    const block = buildPro2StoryboardShotBudgetPromptBlock("3分钟");
    expect(block).toContain("12");
    expect(block).toContain("不得少于");
    expect(block).toContain("禁止只输出 1–2 镜");
  });
});

describe("storyboardMeetsMinimumShotCount", () => {
  const header = `| 镜号 | 景别 | 运镜 | 画面描述 | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|----------|------|----------|---------------------|---------------------|---------------|`;

  it("rejects 2-shot table for 3-minute outline", () => {
    const md = `${header}
| 1 | 中景 | 固定 | 描述 | — | 10 | img | vid | — |
| 2 | 近景 | 固定 | 描述 | — | 8 | img | vid | — |`;
    expect(storyboardMeetsMinimumShotCount(md, "预计时长 | 3分钟")).toBe(false);
  });
});

describe("hubSectionNeedsRun storyboard shot floor", () => {
  const header = `| 镜号 | 景别 | 运镜 | 画面描述 | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|----------|------|----------|---------------------|---------------------|---------------|`;

  it("re-runs when done but below minimum shots", () => {
    const node: CanvasFlowNode = {
      id: "hub-1",
      type: "story-pro2-script-hub",
      position: { x: 0, y: 0 },
      data: {
        outlineMd: "预计时长 | 3分钟",
        storyboardMd: `${header}
| 1 | 中景 | 固定 | 描述 | — | 10 | img | vid | — |
| 2 | 近景 | 固定 | 描述 | — | 8 | img | vid | — |`,
        storyboardRuntime: { status: "done", taskId: "t-1" },
      },
    };
    expect(hubSectionNeedsRun(node, "storyboard", false)).toBe(true);
  });
});
