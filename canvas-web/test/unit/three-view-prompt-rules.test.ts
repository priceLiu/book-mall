import { describe, expect, it } from "vitest";
import {
  buildPro2ThreeViewDockPrompt,
  buildThreeViewCharacterBody,
  normalizeThreeViewDockPrompt,
  resolveCharacterRowThreeViewPrompt,
  THREE_VIEW_SYSTEM_SUFFIX_ZH,
  THREE_VIEW_TURNAROUND_REQUIREMENT_EN,
} from "@/lib/canvas/three-view-prompt-rules";
import { appendVisualStylePackToDockPrompt } from "@/lib/canvas/story-pro-visual-style-pack";

const SAMPLE_PORTRAIT_EN =
  "A stunning 20-year-old Chinese woman, oval face, cherry blossom pink lips, wearing Tang Dynasty hanfu, cinematic portrait, photorealistic";

const SAMPLE_APPEARANCE_ZH =
  "黑色发丝，高耸云鬓，点缀精致珍珠步摇；内穿白色广袖，外罩鹅黄色绣绸夹与飘逸薄纱长裙。紧张时下意识绞手指。";

describe("three-view-prompt-rules", () => {
  it("includes structured Chinese table fields before system constraints", () => {
    const prompt = resolveCharacterRowThreeViewPrompt({
      name: "沈知意",
      role: "京城第一富商之女",
      appearance: SAMPLE_APPEARANCE_ZH,
      personality: "表面端庄，内心倔强",
      aiImagePrompt: SAMPLE_PORTRAIT_EN,
    });
    expect(prompt).toContain("角色：沈知意");
    expect(prompt).toContain("外貌/服装/标志性动作：");
    expect(prompt).toContain(SAMPLE_APPEARANCE_ZH);
    expect(prompt).toContain("性格：表面端庄，内心倔强");
    expect(prompt).toContain(`AI生图：${SAMPLE_PORTRAIT_EN}`);
    expect(prompt).toContain("【三视图 · 系统约束】");
    expect(prompt).toContain("恰好三个");
    expect(prompt).toContain("立绘规格须与角色设定一致");
    expect(prompt.indexOf("角色：沈知意")).toBeLessThan(
      prompt.indexOf("【三视图 · 系统约束】"),
    );
    expect(prompt.indexOf("【三视图 · 系统约束】")).toBeLessThan(
      prompt.indexOf(THREE_VIEW_TURNAROUND_REQUIREMENT_EN),
    );
    expect(prompt).not.toContain("【视角数量 · 硬性要求】");
  });

  it("prefers Chinese appearance even when AI column is English-only legacy", () => {
    const body = buildThreeViewCharacterBody({
      name: "沈如意",
      role: "尚书府千金",
      appearance: SAMPLE_APPEARANCE_ZH,
      aiImagePrompt: SAMPLE_PORTRAIT_EN,
    });
    expect(body).toContain(SAMPLE_APPEARANCE_ZH);
    expect(body).toContain(`AI生图：${SAMPLE_PORTRAIT_EN}`);
  });

  it("appends visual style pack after character body and system suffix", () => {
    const dock = buildPro2ThreeViewDockPrompt(
      {
        name: "苏清禾",
        role: "女主",
        appearance: "鹅黄襦裙",
        aiImagePrompt: "一位20岁古代女子，鹅黄襦裙，写实人像",
      },
      {
        era: "架空唐代，长安城",
        visualStyle: "电影感写实",
        colorPalette: "暖金 #F9E4B7",
        lighting: "日景自然逆光",
      },
    );
    expect(dock).toContain("【全片视觉 · 生图统一风格】");
    expect(dock).toContain("年代：架空唐代");
    expect(dock.indexOf("外貌/服装")).toBeLessThan(
      dock.indexOf("【三视图 · 系统约束】"),
    );
    expect(dock.indexOf("【三视图 · 系统约束】")).toBeLessThan(
      dock.indexOf("【全片视觉 · 生图统一风格】"),
    );
  });

  it("reorders legacy prompt with rules-first into content-first", () => {
    const legacy = `${THREE_VIEW_SYSTEM_SUFFIX_ZH}\n${SAMPLE_PORTRAIT_EN}`;
    const reordered = normalizeThreeViewDockPrompt(legacy);
    expect(reordered.indexOf(SAMPLE_PORTRAIT_EN)).toBeLessThan(
      reordered.indexOf("【三视图 · 系统约束】"),
    );
    expect(reordered.match(/【三视图 · 系统约束】/g)?.length).toBe(1);
  });

  it("does not duplicate visual style block when already present at end", () => {
    const withStyle = appendVisualStylePackToDockPrompt("base prompt", {
      era: "唐代",
    });
    const again = appendVisualStylePackToDockPrompt(withStyle, { era: "唐代" });
    expect(again.match(/【全片视觉/g)?.length).toBe(1);
    expect(withStyle.indexOf("base prompt")).toBeLessThan(
      withStyle.indexOf("【全片视觉"),
    );
  });
});
