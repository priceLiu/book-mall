import { describe, expect, it } from "vitest";

import {
  mergeStoryboardPanelVideoGen,
  parseStoryboardPanelVideoGenFromAssetMeta,
} from "@/lib/ecom/ecom-storyboard-panel-video-gen";

describe("parseStoryboardPanelVideoGenFromAssetMeta", () => {
  it("parses panel_video asset meta from model picker", () => {
    const gen = parseStoryboardPanelVideoGenFromAssetMeta({
      kind: "panel_video",
      panelIndex: 2,
      modelKey: "wan2.6-r2v",
      durationSec: 5,
      resolution: "1080p",
      aspectRatio: "9:16",
      generatedAt: "2026-08-30T00:00:00.000Z",
    });
    expect(gen).toEqual({
      modelKey: "wan2.6-r2v",
      durationSec: 5,
      resolution: "1080p",
      aspectRatio: "9:16",
      generatedAt: "2026-08-30T00:00:00.000Z",
    });
  });

  it("returns null when modelKey missing", () => {
    expect(parseStoryboardPanelVideoGenFromAssetMeta({ durationSec: 5 })).toBeNull();
  });
});

describe("mergeStoryboardPanelVideoGen", () => {
  it("prefers sheet panel videoGen over asset", () => {
    expect(
      mergeStoryboardPanelVideoGen(
        { modelKey: "a", durationSec: 3 },
        { modelKey: "b", durationSec: 8 },
      )?.modelKey,
    ).toBe("a");
  });

  it("falls back to asset when panel has no gen", () => {
    expect(
      mergeStoryboardPanelVideoGen(undefined, { modelKey: "seedance", durationSec: 5 })
        ?.modelKey,
    ).toBe("seedance");
  });
});
