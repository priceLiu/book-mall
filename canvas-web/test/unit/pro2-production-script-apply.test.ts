import { describe, expect, it } from "vitest";
import { applyProductionScriptDirectToHub, applyProductionScriptPatchToHub } from "@/lib/canvas/pro2-production-script-apply";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { PRO2_FIXTURE_FULL_PACK } from "../fixtures/pro2-production-script-fixture";

describe("pro2-production-script-apply", () => {
  it("writes productionScript, *Md, and scriptStudio rows", () => {
    const hub: StoryProScriptHubNodeData = {
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      providerId: "p",
      modelKey: "m",
      promptOutline: "",
      promptCharacter: "",
      promptStoryboard: "",
    };

    const patch = applyProductionScriptPatchToHub(
      hub,
      PRO2_FIXTURE_FULL_PACK,
      "hub-test",
    );

    expect(patch.productionScript?.shots?.length).toBe(2);
    expect(patch.outlineMd).toContain("视觉风格总纲");
    expect(patch.outlineMd).toContain("故事背景");
    expect(patch.characterMd).toContain("沈知意");
    expect(patch.storyboardMd).toContain("| 1 | 全景 |");
    expect(patch.visualStylePack?.worldBackground).toContain("晚唐");

    expect(patch.scriptStudioCharacterRows?.length).toBe(1);
    expect(patch.scriptStudioFrameRows?.length).toBe(2);
    const frame = patch.scriptStudioFrameRows?.[0];
    expect(frame?.shotSize).toBe("全景");
    expect(frame?.cameraMove).toBe("缓慢摇移");
    expect(frame?.durationSec).toBe(10);
    expect(frame?.aiImagePrompt).toContain("大全景");
    expect(frame?.videoPrompt).toContain("scene_A");
  });

  it("applyProductionScriptDirectToHub syncs all sections", () => {
    const hub: StoryProScriptHubNodeData = {
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      providerId: "p",
      modelKey: "m",
      promptOutline: "",
      promptCharacter: "",
      promptStoryboard: "",
    };
    const merged = applyProductionScriptPatchToHub(hub, PRO2_FIXTURE_FULL_PACK);
    const script = merged.productionScript!;
    const direct = applyProductionScriptDirectToHub(
      { ...hub, ...merged },
      script,
      "hub-test",
    );
    expect(direct.outlineMd).toContain("视觉风格总纲");
    expect(direct.storyboardMd).toContain("| 1 | 全景 |");
  });
});
