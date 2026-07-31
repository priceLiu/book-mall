import { describe, expect, it } from "vitest";

import {
  computeLibtvMediaAspectPresetSize,
  parseAspectRatioToNumbers,
  resolveEffectiveAspectRatioForPreset,
  resolveLibtvMediaAspectPresetProfile,
  shouldSkipLibtvMediaAspectPresetForNaturalMedia,
} from "@/lib/canvas/libtv-media-aspect-preset";
import {
  LIBTV_IMAGE_NODE_HEADER_HEIGHT,
  LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE,
} from "@/lib/canvas/libtv-node-chrome";
import {
  PRO2_CHARACTER_THREE_VIEW_WIDTH,
} from "@/lib/canvas/story-pro2-node-chrome";

describe("libtv-media-aspect-preset", () => {
  it("parses common aspect strings", () => {
    expect(parseAspectRatioToNumbers("16:9")).toEqual({ w: 16, h: 9 });
    expect(parseAspectRatioToNumbers("9:16")).toEqual({ w: 9, h: 16 });
    expect(parseAspectRatioToNumbers("auto")).toEqual({ w: 1, h: 1 });
  });

  it("resolves auto to role defaults", () => {
    expect(
      resolveEffectiveAspectRatioForPreset("auto", "three-view"),
    ).toBe("16:9");
    expect(
      resolveEffectiveAspectRatioForPreset("auto", "pro2-frame-cell"),
    ).toBe("16:9");
    expect(resolveEffectiveAspectRatioForPreset("auto", "sbv1-video")).toBe(
      "4:3",
    );
    expect(resolveEffectiveAspectRatioForPreset("auto", "pro2-image")).toBe(
      "1:1",
    );
  });

  it("three-view 16:9 scales preset size from legacy base width", () => {
    const size = computeLibtvMediaAspectPresetSize("16:9", "three-view");
    expect(size.width).toBe(
      PRO2_CHARACTER_THREE_VIEW_WIDTH * LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE,
    );
    const stageH = size.height - LIBTV_IMAGE_NODE_HEADER_HEIGHT;
    expect(stageH).toBe(
      Math.round(
        PRO2_CHARACTER_THREE_VIEW_WIDTH *
          LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE *
          (9 / 16),
      ),
    );
  });

  it("maps pro2 scene/frame cells to pro2-frame-cell profile", () => {
    expect(
      resolveLibtvMediaAspectPresetProfile({
        type: "story-pro2-image",
        data: { pro2MediaRole: "scene" },
      }),
    ).toBe("pro2-frame-cell");
  });

  it("portrait 9:16 yields taller card than landscape", () => {
    const land = computeLibtvMediaAspectPresetSize("16:9", "pro2-image");
    const port = computeLibtvMediaAspectPresetSize("9:16", "pro2-image");
    expect(port.height).toBeGreaterThan(land.height);
    expect(port.width).toBeLessThanOrEqual(land.width);
  });

  it("skips aspect preset for pasted upload blobs", () => {
    expect(
      shouldSkipLibtvMediaAspectPresetForNaturalMedia({
        type: "story-pro2-image",
        data: { blobUrl: "blob:abc", uploading: true },
      }),
    ).toBe(true);
    expect(
      shouldSkipLibtvMediaAspectPresetForNaturalMedia({
        type: "story-pro2-image",
        data: { pro2MediaRole: "scene", blobUrl: "blob:abc" },
      }),
    ).toBe(false);
    expect(
      shouldSkipLibtvMediaAspectPresetForNaturalMedia({
        type: "story-pro2-image",
        data: { aspectRatio: "16:9" },
      }),
    ).toBe(false);
  });
});
