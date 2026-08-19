import { describe, expect, it } from "vitest";
import {
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import { mergeProductionScriptPatch } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  renderProductionScriptMarkdown,
  renderProductionScriptStoryboardMd,
} from "@/lib/canvas/pro2-production-script-render-md";
import { PRO2_FIXTURE_FULL_PACK } from "../fixtures/pro2-production-script-fixture";

describe("pro2-production-script-render-md", () => {
  const script = mergeProductionScriptPatch(undefined, PRO2_FIXTURE_FULL_PACK);

  it("renders storyboard table header aligned with pack standard", () => {
    const md = renderProductionScriptStoryboardMd(script);
    expect(md).toContain(STORY_PRO2_STORYBOARD_TABLE_HEADER.split("\n")[0]!);
    expect(md).toContain("| 1 | 全景 | 缓慢摇移 |");
    expect(md).toContain("AI生图提示词(英文)");
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
});
