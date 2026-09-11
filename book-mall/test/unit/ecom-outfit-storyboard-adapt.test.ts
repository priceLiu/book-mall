import { describe, expect, it } from "vitest";

import {
  buildOutfitOriginalStoryboardText,
  parseOutfitStoryboardAdaptLlmOutput,
} from "@/lib/ecom/ecom-outfit-storyboard-adapt";
import {
  buildOutfitModelSceneBrief,
  buildOutfitStoryboardAdaptUserMessage,
  normalizeOutfitUserSellPointForLlm,
  OUTFIT_PRODUCTION_FENCE,
} from "@/lib/ecom/ecom-outfit-storyboard-adapt-prompts";
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

  it("parseOutfitStoryboardAdaptLlmOutput falls back character_action from final_storyboard", () => {
    const raw = `{
  "final_storyboard": "模特展示@图片1的新款连衣裙",
  "positive_prompt": "正向"
}`;
    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.characterAction).toBe("@图片1模特展示@图片1的新款连衣裙");
    }
  });

  it("parseOutfitStoryboardAdaptLlmOutput coerces null and non-string LLM fields", () => {
    const raw = `{
  "mode": null,
  "character_action": null,
  "final_storyboard": "模特展示@图片1",
  "positive_prompt": "正向提示词",
  "negative_prompt": ["穿模", "畸变"]
}`;
    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.mode).toBe("");
      expect(parsed.data.characterAction).toBe("@图片1模特展示@图片1");
      expect(parsed.data.negativePrompt).toBe("穿模 畸变");
    }
  });

  it("parseOutfitStoryboardAdaptLlmOutput accepts JSON array wrapper", () => {
    const raw = `[{
  "character_action": "缓步展示",
  "final_storyboard": "4s 完整描述",
  "positive_prompt": "正向"
}]`;
    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.finalStoryboard).toBe("4s 完整描述");
      expect(parsed.data.characterAction).toContain("@图片1");
    }
  });

  it("parseOutfitStoryboardAdaptLlmOutput normalizes bare 模特 and plain 图片1", () => {
    const raw = `{
  "character_action": "模特身着图片1中的层叠蛋糕短裙，缓步向前",
  "final_storyboard": "4s 完整描述",
  "positive_prompt": "竖屏电商短视频"
}`;
    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.characterAction).toBe(
        "@图片1模特身着@图片1中的层叠蛋糕短裙，缓步向前",
      );
      expect(parsed.data.positivePrompt).toContain("@图片1");
    }
  });

  it("parseOutfitStoryboardAdaptLlmOutput repairs trailing commas in JSON", () => {
    const raw = `{
  "character_action": "展示",
  "final_storyboard": "4s 完整描述",
  "positive_prompt": "正向",
}`;
    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    expect(parsed.ok).toBe(true);
  });

  it("parseOutfitStoryboardAdaptLlmOutput prefers ecom-outfit-production fence", () => {
    const raw = `\`\`\`${OUTFIT_PRODUCTION_FENCE}
{
  "character_action": "缓步展示@图片1",
  "final_storyboard": "4s 完整描述",
  "positive_prompt": "正向提示词"
}
\`\`\``;
    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    expect(parsed.ok).toBe(true);
  });

  it("parseOutfitStoryboardAdaptLlmOutput accepts snake_case JSON", () => {
    const raw = `\`\`\`json
{
  "original_storyboard": "原文",
  "cloth_analyse": "品类：连衣裙",
  "user_sell_point": "无",
  "mode": "B-AI自动识别卖点模式",
  "adjust_logic": "保留机位，微调手部",
  "character_action": "展示新款垂感裙摆",
  "scene_background": "纯白摄影棚",
  "final_storyboard": "4s 完整描述",
  "positive_prompt": "正向提示词",
  "negative_prompt": "穿模"
}
\`\`\``;
    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.finalStoryboard).toBe("4s 完整描述");
      expect(parsed.data.characterAction).toBe("@图片1 展示新款垂感裙摆");
      expect(parsed.data.positivePrompt).toBe("@图片1 正向提示词");
    }
  });

  it("buildOutfitStoryboardAdaptUserMessage includes model/scene brief", () => {
    const msg = buildOutfitStoryboardAdaptUserMessage({
      referenceSkeleton: "镜号 1",
      clothAnalyseText: "品类：连衣裙",
      modelSceneBrief: buildOutfitModelSceneBrief({
        modelGallery: [{ id: "m1", ossUrl: "https://example.com/m.jpg", label: "参考 1" }],
        sceneLibraryPreset: {
          entryId: "white",
          entryName: "白棚",
          visualPromptFragment: "纯白无缝背景",
        },
      }),
      userSellPoint: "无",
    });
    expect(msg).toContain("新服装识别（权威）");
    expect(msg).toContain("模特与场景（权威）");
    expect(msg).toContain("纯白无缝背景");
    expect(msg).toContain("品类：连衣裙");
    expect(msg).toContain(OUTFIT_PRODUCTION_FENCE);
  });
});
