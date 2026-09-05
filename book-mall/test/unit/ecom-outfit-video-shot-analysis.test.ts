import { describe, expect, it } from "vitest";

import {
  buildOutfitShotPrefilledGeneratePrompt,
  resolveOutfitShotGeneratePrompt,
} from "@/lib/ecom/ecom-outfit-video-generate-prompts";
import {
  appendOutfitShotAnalysisToGeneratePrompt,
  applyOutfitShotAnalysisToScene,
  parseOutfitSplitBatchEnrichFromLlm,
} from "@/lib/ecom/video-workflow/templates/outfit-v1/shot-analysis";

describe("outfit-v1 shot-analysis", () => {
  it("parses batch enrich JSON for all scenes", () => {
    const raw = `\`\`\`ecom-outfit-split
{"action":"scene_split_enrich_complete","templateId":"outfit-v1","scenes":[{"sceneId":"s1","characterAction":"模特转身展示侧面","cameraMove":"慢推近景","lightingSetup":"侧顺柔光，自然窗光补面","sceneBackground":"室内试衣镜前，白墙背景","parseIncomplete":false},{"sceneId":"s2","characterAction":"向前走秀展示服装","cameraMove":"横移跟拍","lightingSetup":"顶光补面，暖色温","sceneBackground":"T台背景，浅灰地面","motionType":"walk_forward"}]}
\`\`\``;
    const map = parseOutfitSplitBatchEnrichFromLlm(raw);
    expect(map.size).toBe(2);
    expect(map.get("s1")?.characterAction).toContain("转身");
  });

  it("does not append camera/action to generate prompt (§十)", () => {
    const scene = applyOutfitShotAnalysisToScene(
      {
        sceneId: "s1",
        index: 1,
        startTimeSec: 0,
        endTimeSec: 3,
        durationSec: 3,
      },
      {
        characterAction: "站立展示",
        cameraMove: "固定机位",
        lightingSetup: "自然窗光，侧顺柔光",
        sceneBackground: "白墙工作室，简约空间",
      },
    );
    const prefilled = buildOutfitShotPrefilledGeneratePrompt(scene);
    expect(prefilled).toContain("自然窗光");
    expect(prefilled).toContain("白墙工作室");
    expect(prefilled).not.toContain("固定机位");
    expect(prefilled).not.toContain("站立展示");

    const legacy = appendOutfitShotAnalysisToGeneratePrompt("BASE", scene);
    expect(legacy).toBe("BASE");
  });

  it("respects userGeneratePrompt including empty string", () => {
    const scene = {
      sceneId: "s1",
      index: 1,
      startTimeSec: 0,
      endTimeSec: 3,
      durationSec: 3,
      userGeneratePrompt: "",
      lightingSetup: "自然窗光",
      sceneBackground: "白墙",
    };
    expect(resolveOutfitShotGeneratePrompt(scene)).toBe("");
  });

  it("skips light/scene when parseIncomplete", () => {
    const scene = {
      sceneId: "s1",
      index: 1,
      startTimeSec: 0,
      endTimeSec: 3,
      durationSec: 3,
      parseIncomplete: true,
      lightingSetup: "顶部暖色灯带加正面柔和补光",
      sceneBackground: "米色墙面室内空间",
    };
    const prefilled = buildOutfitShotPrefilledGeneratePrompt(scene);
    expect(prefilled).toBe("9:16竖屏，商业电商穿搭短视频，高清画质，真实服装面料，画面稳定流畅");
  });
});
