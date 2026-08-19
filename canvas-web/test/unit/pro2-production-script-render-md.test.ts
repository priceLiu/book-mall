import { describe, expect, it } from "vitest";
import {
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import { mergeProductionScriptPatch } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  enrichStoryboardMdPropNames,
  renderHubOutlineDisplayMd,
  renderProductionScriptMarkdown,
  renderProductionScriptStoryboardMd,
} from "@/lib/canvas/pro2-production-script-render-md";
import { ensurePro2ProductionScriptSchemaVersion } from "@/lib/canvas/data/pro2-production-script-schema";
import { PRO2_FIXTURE_FULL_PACK } from "../fixtures/pro2-production-script-fixture";

describe("pro2-production-script-render-md", () => {
  const script = mergeProductionScriptPatch(undefined, PRO2_FIXTURE_FULL_PACK);

  it("renders storyboard table header aligned with pack standard", () => {
    const md = renderProductionScriptStoryboardMd(script);
    expect(md).toContain(STORY_PRO2_STORYBOARD_TABLE_HEADER.split("\n")[0]!);
    expect(md).toContain("| 1 | 全景 | 正午暖金侧逆光");
    expect(md).toContain("明黄婚书");
    expect(md).not.toContain("AI生图提示词(英文)");
  });

  it("renders scene and character sections", () => {
    const md = renderProductionScriptMarkdown(script);
    expect(md).toContain("## 视觉风格总纲");
    expect(md).toContain("故事背景");
    expect(md).toContain(STORY_PRO2_SCENE_TABLE_HEADER.split("\n")[0]!);
    expect(md).toContain(STORY_PRO2_CHARACTER_TABLE_HEADER.split("\n")[0]!);
    expect(md).toContain("沈知意");
    expect(md).toContain("## 下一步交接清单");
  });

  it("renderHubOutlineDisplayMd aggregates meta, style, conflict, characters, scenes, handoff", () => {
    const md = renderHubOutlineDisplayMd(script);
    expect(md).toContain("# ");
    expect(md).toContain("## 视觉风格总纲");
    expect(md).toContain("## 核心冲突");
    expect(md).toContain("## 角色视觉辞典");
    expect(md).toContain("## 场景视觉辞典");
    expect(md).toContain("## 下一步交接清单");
    expect(md).not.toContain("## 分镜脚本");
  });

  it("infers v2 schema for storyboard render when lighting/props present", () => {
    const legacy = {
      ...script,
      schemaVersion: undefined as unknown as 2,
    };
    const normalized = ensurePro2ProductionScriptSchemaVersion(legacy);
    expect(normalized.schemaVersion).toBe(2);
    const md = renderProductionScriptStoryboardMd(normalized);
    expect(md).toContain("| 道具 |");
    expect(md).toContain("明黄婚书");
  });

  it("enrichStoryboardMdPropNames merges fallback markdown prop column", () => {
    const rendered = renderProductionScriptStoryboardMd({
      ...script,
      shots: [
        {
          ...script.shots![0]!,
          propIds: [],
        },
      ],
    });
    const fallback = rendered.replace("— |", "明黄婚书 |");
    const enriched = enrichStoryboardMdPropNames(rendered, fallback, script);
    expect(enriched).toContain("明黄婚书");
  });
});
