import { describe, expect, it } from "vitest";
import {
  buildPro2CharacterImagePromptFromStructuredFields,
  formatPro2CharacterAppearanceCell,
} from "@/lib/canvas/pro2-character-script-fields";

describe("pro2-character-script-fields", () => {
  it("merges traits into appearance cell with line breaks", () => {
    const cell = formatPro2CharacterAppearanceCell({
      description: "女，28岁，偏瘦",
      clothing: "浅灰条纹衬衫",
      traits: "眼下黑眼圈，双颊微陷",
    });
    expect(cell).toContain("① 外貌：");
    expect(cell).toContain("② 服装：");
    expect(cell).toContain("③ 特征：");
    expect(cell.split("\n").length).toBeGreaterThanOrEqual(3);
  });

  it("preserves prestructured appearance cell from LLM without re-splitting", () => {
    const fromLlm = `① 外貌：女，28岁，身高1.65米，偏瘦，瓜子脸
② 服装：宽松浅灰色条纹衬衫，黑色西装长裤
③ 特征：①眼下明显黑眼圈 ②双颊微陷 ③眉心两道浅纹`;
    const cell = formatPro2CharacterAppearanceCell({
      appearance: fromLlm,
      description: "应被忽略",
      clothing: "应被忽略",
      traits: "应被忽略",
    });
    expect(cell).toBe(fromLlm);
    expect(cell).not.toContain("应被忽略");
  });

  it("coerces ①② + 标志性动作 third line into ③特征", () => {
    const fromLlm = `① 外貌：女，28岁
② 服装：浅灰条纹衬衫
③ 标志性动作：伏案抬头`;
    const cell = formatPro2CharacterAppearanceCell({
      appearance: fromLlm,
      traits: "眼下黑眼圈",
    });
    expect(cell).toContain("① 外貌：");
    expect(cell).toContain("② 服装：");
    expect(cell).toContain("③ 特征：");
    expect(cell).toContain("眼下黑眼圈");
    expect(cell).not.toContain("标志性动作");
  });

  it("strips literal br tags in appearance display", () => {
    const cell = formatPro2CharacterAppearanceCell({
      description: "女，28岁",
      clothing: "衬衫",
      traits: "黑眼圈",
      appearance: "① 外貌：女<br/>② 服装：衬衫",
    });
    expect(cell).not.toContain("<br");
    expect(cell).toContain("\n");
  });

  it("coerces legacy prose with 标志性动作 into ①②③ and strips actions", () => {
    const cell = formatPro2CharacterAppearanceCell({
      appearance:
        "28岁，面容清秀苍白，现代装为白衬衫+黑西裤；盛唐男装为青色圆领官袍，束发戴幞头，腰系革带，身形纤细。标志性动作：从伏案抬头到挺直脊背",
    });
    expect(cell).toContain("① 外貌：");
    expect(cell).toContain("② 服装：");
    expect(cell).toContain("③ 特征：");
    expect(cell).toContain("面容清秀苍白");
    expect(cell).toContain("白衬衫");
    expect(cell).not.toContain("标志性动作");
  });

  it("coerces emperor prose row into structured sections", () => {
    const cell = formatPro2CharacterAppearanceCell({
      appearance:
        "中年男性，头戴冕旒，身着明黄龙袍，面容威严，目光深沉。标志性动作：端坐龙椅，缓缓站起",
    });
    expect(cell).toMatch(/① 外貌：[\s\S]*中年男性/);
    expect(cell).toMatch(/② 服装：[\s\S]*明黄龙袍/);
    expect(cell).toContain("③ 特征：");
    expect(cell).not.toContain("标志性动作");
  });

  it("backfills traits from imagePrompt when legacy appearance lacks 特征", () => {
    const cell = formatPro2CharacterAppearanceCell({
      appearance: "中年男性，紫袍玉带，面容刻薄，胡须修剪整齐",
      imagePrompt:
        "名称：大臣\n描述：中年男性\n服装：紫袍玉带\n特征：①面容刻薄 ②胡须修剪整齐 ③眉峰上挑",
    });
    expect(cell).toContain("③ 特征：");
    expect(cell).toContain("面容刻薄");
    expect(cell).not.toContain("标志性动作");
  });

  it("builds golden imagePrompt from structured JSON fields", () => {
    const prompt = buildPro2CharacterImagePromptFromStructuredFields({
      name: "现代沈昭昭",
      role: "现代职场女性",
      description: "女，28岁",
      clothing: "浅灰条纹衬衫",
      traits: "眼下黑眼圈",
      visualStyleTag: "盛唐穿越题材，国风二次元厚涂",
    });
    expect(prompt).toContain("名称：现代沈昭昭");
    expect(prompt).toContain("特征：眼下黑眼圈");
    expect(prompt).toContain("构图规范：");
    expect(prompt).toContain("[视觉风格：");
  });
});
