import { describe, expect, it } from "vitest";

import {
  computeLibtvMediaNodeSize,
  isLibtvMediaNodeBoxStale,
} from "@/lib/canvas/libtv-media-node-size";
import { computeLibtvMediaAspectPresetSize } from "@/lib/canvas/libtv-media-aspect-preset";
import { SBV1_VIDEO_ENGINE_HEIGHT, SBV1_VIDEO_ENGINE_WIDTH } from "@/lib/canvas/sbv1-node-chrome";

describe("computeLibtvMediaNodeSize · sbv1-media", () => {
  it("portrait 9:16 at 100% uses fixed stage height span", () => {
    const size = computeLibtvMediaNodeSize(1080, 1920, "sbv1-media");
    const preset = computeLibtvMediaAspectPresetSize("9:16", "sbv1-video");
    expect(size).toEqual(preset);
    expect(size.width).toBeLessThan(size.height);
  });
});

describe("isLibtvMediaNodeBoxStale", () => {
  it("detects portrait media stuck at factory 635×365", () => {
    const stale = isLibtvMediaNodeBoxStale(
      {
        width: SBV1_VIDEO_ENGINE_WIDTH,
        height: SBV1_VIDEO_ENGINE_HEIGHT,
        data: { mediaFit: true },
      },
      "sbv1-media",
    );
    expect(stale).toBe(true);
  });

  it("detects factory default even when mediaFit is false", () => {
    const stale = isLibtvMediaNodeBoxStale(
      {
        width: SBV1_VIDEO_ENGINE_WIDTH,
        height: SBV1_VIDEO_ENGINE_HEIGHT,
        data: { mediaFit: false },
      },
      "sbv1-media",
    );
    expect(stale).toBe(true);
  });

  it("overrides manualSize when aspect clearly mismatches", () => {
    const stale = isLibtvMediaNodeBoxStale(
      {
        width: SBV1_VIDEO_ENGINE_WIDTH,
        height: SBV1_VIDEO_ENGINE_HEIGHT,
        data: {
          mediaFit: true,
          manualSize: true,
          mediaNaturalW: 1080,
          mediaNaturalH: 1920,
        },
      },
      "sbv1-media",
    );
    expect(stale).toBe(true);
  });

  it("detects box too short when natural dims are stored", () => {
    const expected = computeLibtvMediaNodeSize(1080, 1920, "sbv1-media");
    const stale = isLibtvMediaNodeBoxStale(
      {
        width: expected.width,
        height: SBV1_VIDEO_ENGINE_HEIGHT,
        data: {
          mediaFit: true,
          mediaNaturalW: 1080,
          mediaNaturalH: 1920,
        },
      },
      "sbv1-media",
    );
    expect(stale).toBe(true);
  });

  it("accepts correctly fitted portrait box", () => {
    const expected = computeLibtvMediaNodeSize(1080, 1920, "sbv1-media");
    const stale = isLibtvMediaNodeBoxStale(
      {
        width: expected.width,
        height: expected.height,
        data: {
          mediaFit: true,
          mediaNaturalW: 1080,
          mediaNaturalH: 1920,
        },
      },
      "sbv1-media",
    );
    expect(stale).toBe(false);
  });

  it("detects portrait media in landscape box by aspect mismatch", () => {
    const stale = isLibtvMediaNodeBoxStale(
      {
        width: 635,
        height: 365,
        data: {
          mediaFit: true,
          mediaNaturalW: 1080,
          mediaNaturalH: 1920,
        },
      },
      "sbv1-media",
    );
    expect(stale).toBe(true);
  });
});
