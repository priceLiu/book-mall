import { describe, expect, it } from "vitest";

import {
  PRO2_DEFAULT_SHOT_GFM_EXAMPLE,
  resolvePro2PackProfilePromptRules,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import { parseStoryboardRows } from "@/lib/canvas/parse-md-tables";
import { migrateStoryPromptPackNode } from "@/lib/canvas/story-prompt-pack-migrate";
import {
  STORY_PRO2_PACK_PROMPT_VERSION,
  storyPro2GuFengHubPromptPack,
  storyPro2HubDefaultPromptPack,
} from "@/lib/canvas/story-pro2-theme-outline-prompt";

describe("pro2 production pack standard v8", () => {
  it("parses four full few-shot rows from embedded example", () => {
    const rows = parseStoryboardRows(PRO2_DEFAULT_SHOT_GFM_EXAMPLE);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.frameIndex)).toEqual([1, 4, 5, 8]);
    expect(rows[0]?.description).toContain("【起始】");
    expect(rows[0]?.lighting).toContain("暖金");
    expect(rows[0]?.sfxNote).toContain("议论");
  });

  it("storyboard table header has ten columns v2 Pass1", () => {
    const headerLine = STORY_PRO2_STORYBOARD_TABLE_HEADER.split("\n")[0] ?? "";
    const cols = headerLine.split("|").map((c) => c.trim()).filter(Boolean);
    expect(cols).toHaveLength(10);
    expect(cols).toContain("光影");
    expect(cols).not.toContain("AI生图提示词(英文)");
  });

  it("compact few-shot has only one example row (avoid 2-shot mimic)", () => {
    const pack = storyPro2GuFengHubPromptPack();
    const rows = parseStoryboardRows(pack.promptStoryboard);
    expect(rows.length).toBeLessThanOrEqual(1);
    expect(pack.promptStoryboard).toContain("禁止只输出 1–2 镜样例即停");
  });

  it("default and gu-feng packs forbid Pass1 AI columns", () => {
    const d = storyPro2HubDefaultPromptPack();
    const g = storyPro2GuFengHubPromptPack();
    expect(d.promptStoryboard).toContain("Pass1 禁止");
    expect(g.promptStoryboard).toContain("Pass1 禁止");
    expect(d.promptStoryboard).not.toContain("AI生图提示词(英文)（每镜必填）");
    expect(d.promptStoryboard).toContain("禁止照抄示例剧名");
    expect(g.promptStoryboard).toContain("禁止照抄示例剧名");
    expect(d.promptOutline).toContain("道具视觉辞典");
    expect(d.promptOutline).toContain("12–18 镜");
    expect(g.promptOutline).toContain("高密度糖点");
    expect(d.promptOutline).not.toContain("高密度糖点");
  });

  it("migrate preserves gu-feng pack on v8 bump", () => {
    const migrated = migrateStoryPromptPackNode({
      id: "hub-1",
      type: "story-pro2-script-hub",
      position: { x: 0, y: 0 },
      data: {
        storyPro2PackPromptVersion: 10,
        scriptCategoryId: "gu-feng-tian-chong",
        promptOutline: "legacy outline",
        promptStoryboard: "legacy",
      },
    });
    const data = migrated.data as {
      storyPro2PackPromptVersion?: number;
      promptStoryboard?: string;
    };
    expect(data.storyPro2PackPromptVersion).toBe(STORY_PRO2_PACK_PROMPT_VERSION);
    expect(data.promptStoryboard).toContain("12–18 镜");
    expect(data.promptStoryboard).toContain("Pass1 禁止");
  });

  it("pack profile rules stack industrial + film_pull", () => {
    const director = resolvePro2PackProfilePromptRules({ packProfile: "director" });
    expect(director).toContain("简版");
    expect(director).not.toContain("film_pull");
    const industrial = resolvePro2PackProfilePromptRules({
      packProfile: "industrial",
      source: "creative",
    });
    expect(industrial).toContain("analysis");
    expect(industrial).not.toContain("film_pull");
    const pull = resolvePro2PackProfilePromptRules({
      packProfile: "industrial",
      source: "film_pull",
    });
    expect(pull).toContain("analysis");
    expect(pull).toContain("film_pull");
    expect(pull).toContain("硬切");
  });
});
