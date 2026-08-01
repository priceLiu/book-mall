import { describe, expect, it } from "vitest";

import {
  pro2ScriptCategoryPreset,
  PRO2_SCRIPT_CATEGORY_PRESETS,
  resolvePro2HubPromptPack,
} from "@/lib/canvas/pro2-script-category-presets";
import { pro2ScriptCategorySpawnPosition } from "@/lib/canvas/pro2-script-category-presets";
import {
  pro2ScriptPromptChipBadgeIndex,
  pro2ScriptRefImageBadgeOffset,
  mergePro2ScriptGenerationPrompt,
  stripLegacyPro2ScriptDockInput,
  defaultPro2ScriptCategoryDocBody,
} from "@/lib/canvas/pro2-script-category-doc";
import { storyPro2GuFengHubPromptPack } from "@/lib/canvas/story-pro2-theme-outline-prompt";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";

describe("pro2ScriptCategoryPreset", () => {
  it("registers gu-feng, default-master, and custom-prompt", () => {
    expect(PRO2_SCRIPT_CATEGORY_PRESETS.map((p) => p.id)).toEqual([
      "gu-feng-tian-chong",
      "default-master",
      "custom-prompt",
    ]);
  });

  it("gu-feng hub patch uses category doc chip, not dock @ mention", () => {
    const preset = pro2ScriptCategoryPreset("gu-feng-tian-chong");
    expect(preset?.hubPatch.dockInput).toBe("");
    expect(preset?.hubPatch.scriptCategoryDocTitle).toBe("古风甜宠短剧");
    expect(preset?.starterPatch.label).toBe("故事大纲");
    const doc = defaultPro2ScriptCategoryDocBody("gu-feng-tian-chong") ?? "";
    expect(doc).toContain("【起始】");
    expect(doc).toContain("10–14 镜");
    expect(doc).toContain("| 场景名 | 环境 | 时间 | 气氛 | 生图关键词 |");
    const pack = storyPro2GuFengHubPromptPack();
    expect(pack.promptStoryboard).toContain("高密度糖点");
    expect(pack.promptStoryboard).toContain("Seedance");
    expect(pack.promptStoryboard).toContain("禁止照抄示例剧名");
  });
});

describe("resolvePro2HubPromptPack", () => {
  it("returns gu-feng pack for gu-feng category", () => {
    const pack = resolvePro2HubPromptPack({
      scriptCategoryId: "gu-feng-tian-chong",
    } as StoryProScriptHubNodeData);
    expect(pack.promptOutline).toContain("古风甜宠");
  });

  it("returns default pack without gu-feng铁律 when category unset", () => {
    const pack = resolvePro2HubPromptPack({} as StoryProScriptHubNodeData);
    expect(pack.promptOutline).not.toContain("高密度糖点");
    expect(pack.promptStoryboard).toContain("【起始】");
    expect(pack.promptStoryboard).toContain("Seedance");
  });

  it("default-master uses default pack", () => {
    const pack = resolvePro2HubPromptPack({
      scriptCategoryId: "default-master",
    } as StoryProScriptHubNodeData);
    expect(pack.promptStoryboard).toContain("【起始】");
    expect(pack.promptStoryboard).not.toContain("古风甜宠");
    expect(pack.promptStoryboard).toContain("核心冲突 GFM 表");
  });
});

describe("pro2ScriptCategorySpawnPosition", () => {
  it("places text node to the left of hub", () => {
    const pos = pro2ScriptCategorySpawnPosition(
      { position: { x: 500, y: 200 }, width: 440 },
      440,
      48,
    );
    expect(pos).toEqual({ x: 12, y: 200 });
  });
});

describe("stripLegacyPro2ScriptDockInput", () => {
  it("clears legacy @docs gu-feng mention", () => {
    expect(stripLegacyPro2ScriptDockInput("@docs/古风田宠短剧.md")).toBe("");
    expect(stripLegacyPro2ScriptDockInput("@docs/古风甜宠短剧.md")).toBe("");
  });

  it("keeps user supplement text", () => {
    expect(stripLegacyPro2ScriptDockInput("补充创意")).toBe("补充创意");
  });
});

describe("mergePro2ScriptGenerationPrompt", () => {
  it("combines outline and category doc for LLM", () => {
    const merged = mergePro2ScriptGenerationPrompt(
      "base pack",
      "",
      [],
      {
        scriptCategoryId: "gu-feng-tian-chong",
        categoryDoc: "古风铁律",
        outlineMd: "## 大纲正文",
      },
    );
    expect(merged).toContain("## 故事大纲");
    expect(merged).toContain("## 大纲正文");
    expect(merged).toContain("## 剧本类别参考");
    expect(merged).toContain("古风铁律");
  });

  it("omits category doc when includeCategoryDoc is false (storyboard segment)", () => {
    const merged = mergePro2ScriptGenerationPrompt(
      "base pack",
      "",
      [],
      {
        scriptCategoryId: "gu-feng-tian-chong",
        categoryDoc: "古风铁律",
        outlineMd: "## 大纲正文",
        includeCategoryDoc: false,
      },
    );
    expect(merged).toContain("## 故事大纲");
    expect(merged).not.toContain("## 剧本类别参考");
  });
});

describe("pro2 dock badge indexing", () => {
  it("continues 1,2,3 across upstream, prompt chip, ref images", () => {
    expect(pro2ScriptPromptChipBadgeIndex(1)).toBe(2);
    expect(pro2ScriptRefImageBadgeOffset(1, true)).toBe(2);
    expect(pro2ScriptRefImageBadgeOffset(0, true)).toBe(1);
  });
});
