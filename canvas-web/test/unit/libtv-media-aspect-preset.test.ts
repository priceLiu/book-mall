import { describe, expect, it } from "vitest";

import {
  computeLibtvMediaAspectPresetSize,
  libtvMediaTopEdgeSpan,
  parseAspectRatioToNumbers,
  resolveEffectiveAspectRatioForPreset,
  resolveLibtvMediaAspectPresetProfile,
  shouldSkipLibtvMediaAspectPresetForNaturalMedia,
} from "@/lib/canvas/libtv-media-aspect-preset";
import {
  LIBTV_IMAGE_NODE_HEADER_HEIGHT,
  LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE,
  LIBTV_MEDIA_STAGE_LANDSCAPE_WIDTH,
  LIBTV_MEDIA_STAGE_PORTRAIT_HEIGHT,
  LIBTV_MEDIA_STAGE_SQUARE_EDGE,
  LIBTV_MEDIA_TOP_EDGE_LANDSCAPE_BASE,
  LIBTV_MEDIA_TOP_EDGE_PORTRAIT_BASE,
  LIBTV_MEDIA_TOP_EDGE_SQUARE_BASE,
  LIBTV_VIDEO_NODE_HEADER_HEIGHT,
} from "@/lib/canvas/libtv-node-chrome";
import { PRO2_CHARACTER_THREE_VIEW_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";

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

  it("three-view 16:9 uses character three-view base width at 100%", () => {
    const size = computeLibtvMediaAspectPresetSize("16:9", "three-view");
    expect(size.width).toBe(PRO2_CHARACTER_THREE_VIEW_WIDTH);
    const stageH = size.height - LIBTV_IMAGE_NODE_HEADER_HEIGHT;
    expect(stageH).toBe(Math.round(PRO2_CHARACTER_THREE_VIEW_WIDTH * (9 / 16)));
  });

  it("maps story-pro2-image in group with videos to sbv1-video profile", () => {
    expect(
      resolveLibtvMediaAspectPresetProfile(
        {
          type: "story-pro2-image",
          parentId: "g1",
          data: {},
        },
        [
          {
            id: "g1",
            type: "group",
            position: { x: 0, y: 0 },
            data: { sbv1Styled: true },
          },
          {
            id: "v1",
            type: "sbv1-video-engine",
            parentId: "g1",
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
      ),
    ).toBe("sbv1-video");
  });

  it("maps story-pro2-image in pro2 frame-board mixed with videos to sbv1-video", () => {
    expect(
      resolveLibtvMediaAspectPresetProfile(
        {
          type: "story-pro2-image",
          parentId: "g1",
          data: { pro2MediaRole: "generic", aspectRatio: "9:16" },
        },
        [
          {
            id: "g1",
            type: "group",
            position: { x: 0, y: 0 },
            data: { pro2Kind: "frame-board" },
          },
          {
            id: "v1",
            type: "sbv1-video-engine",
            parentId: "g1",
            position: { x: 0, y: 0 },
            data: { aspectRatio: "9:16" },
          },
        ],
      ),
    ).toBe("sbv1-video");
    const video = computeLibtvMediaAspectPresetSize("9:16", "sbv1-video");
    const image = computeLibtvMediaAspectPresetSize("9:16", "pro2-image");
    expect(video.width).toBe(image.width);
    expect(video.width).toBe(
      Math.round(LIBTV_MEDIA_STAGE_PORTRAIT_HEIGHT * (9 / 16)),
    );
  });

  it("sbv1-image and sbv1-video share the same aspect preset box", () => {
    for (const ratio of ["16:9", "9:16", "4:3", "1:1"]) {
      const image = computeLibtvMediaAspectPresetSize(ratio, "sbv1-image");
      const video = computeLibtvMediaAspectPresetSize(ratio, "sbv1-video");
      expect(image).toEqual(video);
    }
  });

  it("maps sbv1-image to sbv1-video profile", () => {
    expect(
      resolveLibtvMediaAspectPresetProfile({
        type: "sbv1-image",
        data: {},
      }),
    ).toBe("sbv1-video");
  });

  it("maps pro2 scene cells to three-view profile and frame cells to pro2-frame-cell", () => {
    expect(
      resolveLibtvMediaAspectPresetProfile({
        type: "story-pro2-image",
        data: { pro2MediaRole: "scene" },
      }),
    ).toBe("three-view");
    expect(
      resolveLibtvMediaAspectPresetProfile({
        type: "story-pro2-image",
        data: { pro2MediaRole: "frame" },
      }),
    ).toBe("pro2-frame-cell");
  });

  it("uses 100% canvas standard spans for landscape / portrait / square", () => {
    expect(libtvMediaTopEdgeSpan("landscape")).toBe(
      LIBTV_MEDIA_TOP_EDGE_LANDSCAPE_BASE * LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE,
    );
    expect(libtvMediaTopEdgeSpan("portrait")).toBe(
      LIBTV_MEDIA_TOP_EDGE_PORTRAIT_BASE * LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE,
    );
    expect(libtvMediaTopEdgeSpan("square")).toBe(
      LIBTV_MEDIA_TOP_EDGE_SQUARE_BASE * LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE,
    );

    const land = computeLibtvMediaAspectPresetSize("16:9", "pro2-image");
    const port = computeLibtvMediaAspectPresetSize("9:16", "pro2-image");
    const square = computeLibtvMediaAspectPresetSize("1:1", "pro2-image");

    expect(land.width).toBe(LIBTV_MEDIA_STAGE_LANDSCAPE_WIDTH);
    expect(land.height - LIBTV_IMAGE_NODE_HEADER_HEIGHT).toBe(
      Math.round(LIBTV_MEDIA_STAGE_LANDSCAPE_WIDTH * (9 / 16)),
    );
    expect(port.width).toBe(
      Math.round(LIBTV_MEDIA_STAGE_PORTRAIT_HEIGHT * (9 / 16)),
    );
    expect(port.height - LIBTV_IMAGE_NODE_HEADER_HEIGHT).toBe(
      LIBTV_MEDIA_STAGE_PORTRAIT_HEIGHT,
    );
    expect(square.width).toBe(LIBTV_MEDIA_STAGE_SQUARE_EDGE);
    expect(square.height - LIBTV_IMAGE_NODE_HEADER_HEIGHT).toBe(
      LIBTV_MEDIA_STAGE_SQUARE_EDGE,
    );
    expect(port.height).toBeGreaterThan(land.height);
  });

  it("16:9 sbv1-video stage matches 630×354 at 100%", () => {
    const size = computeLibtvMediaAspectPresetSize("16:9", "sbv1-video");
    expect(size.width).toBe(630);
    expect(size.height - LIBTV_VIDEO_NODE_HEADER_HEIGHT).toBe(354);
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
