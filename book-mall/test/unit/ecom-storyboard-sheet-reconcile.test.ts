import { describe, expect, it } from "vitest";

import { mergeStoryboardPanelMediaByIndex } from "@/lib/ecom/ecom-storyboard-sheet-reconcile";
import type { StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";

const basePanel = (index: number, scene = "scene") => ({
  index,
  shotType: "中景",
  scene,
  action: scene,
});

describe("mergeStoryboardPanelMediaByIndex", () => {
  it("merges imageUrl from incoming into base panels", () => {
    const base: StoryboardSheet["panels"] = [
      basePanel(1),
      basePanel(2),
      basePanel(6),
    ];
    const incoming: StoryboardSheet["panels"] = [
      { ...basePanel(2), imageUrl: "https://cdn.example/2.png" },
      { ...basePanel(6), imageUrl: "https://cdn.example/6.png" },
    ];
    const merged = mergeStoryboardPanelMediaByIndex(base, incoming);
    expect(merged.find((p) => p.index === 2)?.imageUrl).toBe(
      "https://cdn.example/2.png",
    );
    expect(merged.find((p) => p.index === 6)?.imageUrl).toBe(
      "https://cdn.example/6.png",
    );
    expect(merged.find((p) => p.index === 1)?.imageUrl).toBeUndefined();
  });

  it("appends panels present only in incoming", () => {
    const base: StoryboardSheet["panels"] = [basePanel(1), basePanel(2)];
    const incoming: StoryboardSheet["panels"] = [
      { ...basePanel(6), imageUrl: "https://cdn.example/6.png" },
    ];
    const merged = mergeStoryboardPanelMediaByIndex(base, incoming);
    expect(merged).toHaveLength(3);
    expect(merged[2]?.index).toBe(6);
    expect(merged[2]?.imageUrl).toBe("https://cdn.example/6.png");
  });
});
