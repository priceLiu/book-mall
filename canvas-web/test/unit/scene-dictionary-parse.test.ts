import { describe, expect, it } from "vitest";
import {
  STORY_PRO2_SCENE_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import {
  formatSceneDictionaryTableMarkdown,
  parseSceneVisualDictionaryRows,
  resolveSceneDictionaryMarkdown,
} from "@/lib/canvas/parse-md-tables";

describe("scene visual dictionary parse", () => {
  it("parses canonical 4-column scene table", () => {
    const md = `## 场景视觉辞典

${STORY_PRO2_SCENE_TABLE_HEADER}
| 长安主街·日 | 正午暖金阳光，百姓攒动 | Cinematic Chang'an street | animation, anime |`;

    const rows = parseSceneVisualDictionaryRows(md);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("长安主街·日");
    expect(rows[0]?.envTimeMood).toContain("正午");
    expect(rows[0]?.imageKeywords).toContain("Cinematic");
    expect(rows[0]?.negativePrompt).toContain("animation");
  });

  it("reads legacy 5-column scene table", () => {
    const md = `| 场景名 | 环境 | 时间 | 气氛 | 生图关键词 |
|------|------|------|------|------------|
| 王府花园 | 亭台水榭 | 夜 | 静谧 | moonlit garden |`;

    const rows = parseSceneVisualDictionaryRows(md);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.environment).toContain("亭台");
    expect(rows[0]?.time).toBe("夜");
    expect(rows[0]?.imageKeywords).toContain("moonlit");
  });

  it("resolveSceneDictionaryMarkdown outputs 4-column canonical", () => {
    const legacy = `| 场景名 | 环境 | 时间 | 气氛 | 生图关键词 |
|------|------|------|------|------------|
| 堂屋 | 木质结构 | 日 | 温馨 | warm interior |`;
    const out = resolveSceneDictionaryMarkdown(legacy);
    expect(out).toContain("环境/时间/气氛");
    expect(out).toContain("固定反向提示词");
    expect(out).not.toMatch(/\| 环境 \| 时间 \| 气氛 \|/);
  });

  it("formatSceneDictionaryTableMarkdown round-trips 4 columns", () => {
    const md = formatSceneDictionaryTableMarkdown([
      {
        name: "测试场景",
        envTimeMood: "日 · 暖金",
        environment: "",
        time: "",
        mood: "",
        imageKeywords: "test keywords",
        negativePrompt: "anime",
      },
    ]);
    const rows = parseSceneVisualDictionaryRows(md);
    expect(rows[0]?.negativePrompt).toBe("anime");
  });
});
