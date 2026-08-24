import { describe, expect, it } from "vitest";
import {
  buildWizardAssetMountHubPatch,
  isWizardAssetPreviewMounted,
} from "@/lib/canvas/pro2-wizard-asset-mount";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { storyProSceneRowKey } from "@/lib/canvas/story-pro-scene-asset-catalog";

const HUB_ID = "hub-script-1";

const baseHub = (): StoryProScriptHubNodeData => ({
  productionScript: {
    characters: [
      { id: "c1", name: "沈昭昭", role: "女主", appearance: "…" },
    ],
    scenes: [
      {
        id: "s1",
        name: "金銮殿",
        environmentTimeMood: "白天",
        imagePrompt: "palace",
      },
    ],
    props: [{ id: "p1", name: "玉玺", description: "道具", imagePrompt: "seal" }],
    shots: [{ index: 1, sceneDescription: "test", durationSec: 5 }],
  },
});

describe("buildWizardAssetMountHubPatch", () => {
  it("mounts character preview to scriptStudioCharacterRows", () => {
    const patch = buildWizardAssetMountHubPatch(
      baseHub(),
      HUB_ID,
      "character",
      "c1",
      "https://cdn.example/char.png",
      "task-1",
    );
    expect(patch?.scriptStudioCharacterRows?.[0]).toMatchObject({
      key: "c1",
      runtime: {
        status: "done",
        ossUrl: "https://cdn.example/char.png",
        taskId: "task-1",
      },
    });
  });

  it("mounts scene preview to sceneRows by scene id", () => {
    const patch = buildWizardAssetMountHubPatch(
      baseHub(),
      HUB_ID,
      "scene",
      "s1",
      "https://cdn.example/scene.png",
    );
    const rowKey = storyProSceneRowKey(HUB_ID, "金銮殿");
    expect(patch?.sceneRows?.[0]).toMatchObject({
      key: rowKey,
      runtime: {
        status: "done",
        ossUrl: "https://cdn.example/scene.png",
      },
    });
  });

  it("mounts prop preview to scriptStudioPropRows", () => {
    const patch = buildWizardAssetMountHubPatch(
      baseHub(),
      HUB_ID,
      "prop",
      "p1",
      "https://cdn.example/prop.png",
    );
    expect(patch?.scriptStudioPropRows?.[0]).toMatchObject({
      key: "p1",
      runtime: {
        status: "done",
        ossUrl: "https://cdn.example/prop.png",
      },
    });
  });
});

describe("isWizardAssetPreviewMounted", () => {
  it("returns false when row has no runtime url", () => {
    expect(
      isWizardAssetPreviewMounted(
        baseHub(),
        HUB_ID,
        "character",
        "c1",
        "https://cdn.example/char.png",
      ),
    ).toBe(false);
  });

  it("returns true when row runtime matches draft preview", () => {
    const hub = baseHub();
    const patch = buildWizardAssetMountHubPatch(
      hub,
      HUB_ID,
      "character",
      "c1",
      "https://cdn.example/char.png",
    );
    const merged = { ...hub, ...patch } as StoryProScriptHubNodeData;
    expect(
      isWizardAssetPreviewMounted(
        merged,
        HUB_ID,
        "character",
        "c1",
        "https://cdn.example/char.png",
      ),
    ).toBe(true);
  });
});
