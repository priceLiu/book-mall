import { describe, expect, it } from "vitest";

import {
  hasOutfitPrimaryMention,
  normalizeOutfitProductionMentionFields,
  normalizeOutfitProductionMentionText,
} from "@/lib/ecom/ecom-outfit-production-mentions";

describe("ecom-outfit-production-mentions", () => {
  it("converts plain 图片1 and bare 模特 to @图片1", () => {
    expect(normalizeOutfitProductionMentionText("模特身着图片1中的香槟色短裙")).toBe(
      "@图片1模特身着@图片1中的香槟色短裙",
    );
  });

  it("leaves existing @图片1模特 unchanged", () => {
    const text = "@图片1模特缓步展示垂感裙摆";
    expect(normalizeOutfitProductionMentionText(text)).toBe(text);
  });

  it("prepends @图片1 when field lacks any mention", () => {
    expect(normalizeOutfitProductionMentionText("缓步展示垂感裙摆")).toBe(
      "@图片1 缓步展示垂感裙摆",
    );
  });

  it("normalizes required adapt fields", () => {
    const out = normalizeOutfitProductionMentionFields({
      characterAction: "模特站在画面中央",
      positivePrompt: "9:16 竖屏",
      sceneBackground: "纯白摄影棚",
    });
    expect(hasOutfitPrimaryMention(out.characterAction!)).toBe(true);
    expect(hasOutfitPrimaryMention(out.positivePrompt!)).toBe(true);
    expect(out.characterAction).toContain("@图片1模特");
    expect(out.sceneBackground).toBe("纯白摄影棚");
  });
});
