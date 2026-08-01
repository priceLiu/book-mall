import { describe, expect, it } from "vitest";

import {
  PRO2_DEFAULT_SHOT_GFM_EXAMPLE,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import { parseStoryboardRows } from "@/lib/canvas/parse-md-tables";
import { migrateStoryPromptPackNode } from "@/lib/canvas/story-prompt-pack-migrate";
import {
  STORY_PRO2_PACK_PROMPT_VERSION,
  storyPro2GuFengHubPromptPack,
  storyPro2HubDefaultPromptPack,
} from "@/lib/canvas/story-pro2-theme-outline-prompt";

describe("pro2 production pack standard v6", () => {
  it("parses four full few-shot rows from embedded example", () => {
    const rows = parseStoryboardRows(PRO2_DEFAULT_SHOT_GFM_EXAMPLE);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.frameIndex)).toEqual([1, 4, 5, 8]);
    expect(rows[0]?.description).toContain("【起始】");
    expect(rows[0]?.aiVideoPrompt).toContain("<<<scene_A>>>");
    expect(rows[3]?.aiVideoPrompt).toContain("<<<image");
    expect(rows[3]?.aiVideoPrompt).toContain("女主>>>");
  });

  it("storyboard table header has nine columns", () => {
    const headerLine = STORY_PRO2_STORYBOARD_TABLE_HEADER.split("\n")[0] ?? "";
    const cols = headerLine.split("|").map((c) => c.trim()).filter(Boolean);
    expect(cols).toHaveLength(9);
  });

  it("default and gu-feng packs share Seedance rules and four-shot example", () => {
    const d = storyPro2HubDefaultPromptPack();
    const g = storyPro2GuFengHubPromptPack();
    expect(d.promptStoryboard).toContain("Seedance");
    expect(g.promptStoryboard).toContain("Seedance");
    expect(d.promptStoryboard).toContain("禁止照抄示例剧名");
    expect(g.promptStoryboard).toContain("禁止照抄示例剧名");
    expect(d.promptOutline).toContain("核心冲突 GFM 表");
    expect(g.promptOutline).toContain("高密度糖点");
    expect(d.promptOutline).not.toContain("高密度糖点");
  });

  it("migrate preserves gu-feng pack on v6 bump", () => {
    const migrated = migrateStoryPromptPackNode({
      id: "hub-1",
      type: "story-pro2-script-hub",
      position: { x: 0, y: 0 },
      data: {
        storyPro2PackPromptVersion: 5,
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
    expect(data.promptStoryboard).toContain("高密度糖点");
    expect(data.promptStoryboard).toContain("Seedance");
  });
});
