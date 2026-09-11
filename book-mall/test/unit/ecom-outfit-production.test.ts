import { describe, expect, it } from "vitest";

import {
  applyDefaultSceneFusionToShot,
  buildOutfitProductionFromAdapt,
  sceneWithOutfitProductionOverlay,
} from "@/lib/ecom/ecom-outfit-production";
import type { SceneShot } from "@/lib/ecom/video-workflow/shot-spine";

const baseScene: SceneShot = {
  sceneId: "s1",
  index: 1,
  startTimeSec: 0,
  endTimeSec: 4,
  durationSec: 4,
  cameraMove: "固定机位",
  characterAction: "缓步向前",
  lightingSetup: "柔光",
  sceneBackground: "室内",
};

describe("ecom-outfit-production", () => {
  it("buildOutfitProductionFromAdapt prefers LLM production fields over split", () => {
    const production = buildOutfitProductionFromAdapt(baseScene, {
      status: "success",
      cameraMove: "固定机位平视",
      characterAction: "展示新款 A 字裙垂感，缓步向前",
      lightingSetup: "侧顺柔光",
      sceneBackground: "纯白电商摄影棚",
      positivePrompt: "正向",
      negativePrompt: "负向",
      finalStoryboard: "完整分镜",
      adjustLogic: "按新服装重写动作",
      adaptedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(production.characterAction).toBe("@图片1 展示新款 A 字裙垂感，缓步向前");
    expect(production.sceneBackground).toBe("纯白电商摄影棚");
    expect(production.positivePrompt).toBe("@图片1 正向");
    expect(production.status).toBe("success");
  });

  it("sceneWithOutfitProductionOverlay prefers production fields", () => {
    const overlaid = sceneWithOutfitProductionOverlay({
      ...baseScene,
      outfitProduction: {
        status: "success",
        sceneBackground: "白棚",
      },
    });
    expect(overlaid.sceneBackground).toBe("白棚");
  });

  it("applyDefaultSceneFusionToShot uses global scene preset", () => {
    const next = applyDefaultSceneFusionToShot(baseScene, {
      sceneLibraryPreset: {
        entryId: "lib-1",
        entryName: "白棚",
        visualPromptFragment: "纯白摄影棚",
      },
    });
    expect(next.sceneFusion?.mode).toBe("library");
    expect(next.sceneFusion?.libraryEntryId).toBe("lib-1");
  });
});
