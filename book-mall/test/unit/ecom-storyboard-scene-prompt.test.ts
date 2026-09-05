import { describe, expect, it } from "vitest";

import {
  mergeSceneIntoImagePrompt,
  resolvePanelSceneText,
} from "@/lib/ecom/ecom-storyboard-scene-prompt";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";

const sceneRef: StoryboardReference = {
  id: "s1",
  label: "更衣室",
  role: "scene",
  ossUrl: "https://cdn.example.com/scene.jpg",
};

describe("resolvePanelSceneText", () => {
  it("prefers uploaded scene ref with local panel hint", () => {
    const text = resolvePanelSceneText(
      {
        scene: "全身镜前",
        scenePrompt: "靠近全身镜左侧，暖色顶光",
      },
      [sceneRef],
    );
    expect(text).toContain("场景参考图一致");
    expect(text).toContain("全身镜");
  });

  it("uses scenePrompt when no scene ref", () => {
    const text = resolvePanelSceneText(
      {
        scene: "全身镜前",
        scenePrompt: "羽毛球馆更衣室，暖色顶光，浅木色长椅与挂钩",
      },
      [],
    );
    expect(text).toContain("羽毛球馆更衣室");
  });

  it("mergeSceneIntoImagePrompt prepends scene line", () => {
    const merged = mergeSceneIntoImagePrompt(
      "竖版9:16，写实UGC，女生整理衣领",
      "清晨街角，柔和侧光",
    );
    expect(merged.startsWith("场景：清晨街角")).toBe(true);
  });
});
