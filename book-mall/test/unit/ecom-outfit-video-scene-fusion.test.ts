import { describe, expect, it } from "vitest";

import {
  buildOutfitFollowReferenceSceneFragment,
  buildOutfitSceneFusionPositivePrompt,
} from "@/lib/ecom/ecom-outfit-video-scene-fusion-prompts";
import type { SceneShot } from "@/lib/ecom/video-workflow/shot-spine";

describe("outfit scene fusion prompts", () => {
  it("builds follow-reference fragment from enrich fields", () => {
    const scene = {
      sceneId: "s1",
      index: 1,
      startTimeSec: 0,
      endTimeSec: 4,
      durationSec: 4,
      sceneBackground: "米色墙面室内",
      lightingSetup: "顶部暖色灯带",
    } satisfies SceneShot;
    expect(buildOutfitFollowReferenceSceneFragment(scene)).toBe(
      "米色墙面室内，顶部暖色灯带",
    );
  });

  it("concatenates subject template with scene fragment", () => {
    const prompt = buildOutfitSceneFusionPositivePrompt("高级白棚摄影棚背景");
    expect(prompt).toContain("商业电商人像摄影");
    expect(prompt).toContain("高级白棚摄影棚背景");
  });
});
