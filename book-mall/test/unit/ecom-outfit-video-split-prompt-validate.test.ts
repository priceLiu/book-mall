import { describe, expect, it } from "vitest";

import {
  buildOutfitSplitSystemPromptDisplay,
  outfitSplitUserPromptDisplay,
} from "@/lib/ecom/ecom-outfit-video-split-prompts";
import {
  validateOutfitSplitPrompts,
  validateOutfitSplitSystemPrompt,
  validateOutfitSplitUserPrompt,
} from "@/lib/ecom/ecom-outfit-video-split-prompt-validate";

describe("outfit split prompt validation", () => {
  it("accepts default §十 prompts", () => {
    const v = validateOutfitSplitPrompts(
      buildOutfitSplitSystemPromptDisplay(),
      outfitSplitUserPromptDisplay(),
    );
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it("rejects system missing required output fields", () => {
    const v = validateOutfitSplitSystemPrompt("只有任务描述，没有字段定义");
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("sceneId"))).toBe(true);
  });

  it("rejects user missing fence and scenes", () => {
    const v = validateOutfitSplitUserPrompt("请解析视频");
    expect(v.ok).toBe(false);
    expect(v.errors.length).toBeGreaterThan(1);
  });
});
