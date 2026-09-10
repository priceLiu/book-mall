import { describe, expect, it } from "vitest";

import {
  buildOutfitOriginalStoryboardText,
  parseOutfitStoryboardAdaptLlmOutput,
} from "@/lib/ecom/ecom-outfit-storyboard-adapt";
import { normalizeOutfitUserSellPointForLlm } from "@/lib/ecom/ecom-outfit-storyboard-adapt-prompts";
import type { SceneShot } from "@/lib/ecom/video-workflow/shot-spine";

describe("ecom-outfit-storyboard-adapt", () => {
  it("buildOutfitOriginalStoryboardText joins enrich fields", () => {
    const scene: SceneShot = {
      sceneId: "s1",
      index: 1,
      startTimeSec: 0,
      endTimeSec: 4,
      durationSec: 4,
      cameraType: "中景",
      motionType: "固定",
      characterAction: "缓步向前",
      cameraMove: "轻微推进",
      lightingSetup: "自然光",
      sceneBackground: "简约室内",
    };
    const text = buildOutfitOriginalStoryboardText(scene);
    expect(text).toContain("镜号 1");
    expect(text).toContain("缓步向前");
    expect(text).toContain("简约室内");
  });

  it("normalizeOutfitUserSellPointForLlm maps empty to 无", () => {
    expect(normalizeOutfitUserSellPointForLlm("")).toBe("无");
    expect(normalizeOutfitUserSellPointForLlm("  收腰  ")).toBe("收腰");
  });

  it("parseOutfitStoryboardAdaptLlmOutput accepts snake_case JSON", () => {
    const raw = `\`\`\`json
{
  "original_storyboard": "原文",
  "cloth_analyse": "品类：连衣裙",
  "user_sell_point": "无",
  "mode": "B-AI自动识别卖点模式",
  "adjust_logic": "保留机位，微调手部",
  "final_storyboard": "4s 完整描述",
  "positive_prompt": "正向提示词",
  "negative_prompt": "穿模"
}
\`\`\``;
    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.finalStoryboard).toBe("4s 完整描述");
      expect(parsed.data.positivePrompt).toBe("正向提示词");
    }
  });
});
