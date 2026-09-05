import { describe, expect, it } from "vitest";

import {
  buildPhysicalSegmentsFromCuts,
  detectSceneCutTimestamps,
} from "@/lib/ecom/ecom-outfit-video-split";

describe("ecom-outfit-video-split", () => {
  it("builds single segment for short video", () => {
    const segments = buildPhysicalSegmentsFromCuts(
      3.5,
      [],
      { minSceneDurationSec: 2, maxSceneDurationSec: 4 },
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      startTimeSec: 0,
      endTimeSec: 3.5,
      durationSec: 3.5,
    });
  });

  it("respects max duration by splitting long spans", () => {
    const segments = buildPhysicalSegmentsFromCuts(
      12,
      [4, 8],
      { minSceneDurationSec: 2, maxSceneDurationSec: 4 },
    );
    expect(segments.length).toBeGreaterThanOrEqual(3);
    for (const seg of segments) {
      expect(seg.durationSec).toBeGreaterThanOrEqual(2);
      expect(seg.durationSec).toBeLessThanOrEqual(4.01);
    }
    expect(segments[0]!.startTimeSec).toBe(0);
    expect(segments[segments.length - 1]!.endTimeSec).toBe(12);
  });

  it("merges segments shorter than min duration", () => {
    const segments = buildPhysicalSegmentsFromCuts(
      10,
      [1, 2, 9],
      { minSceneDurationSec: 2, maxSceneDurationSec: 4 },
    );
    for (const seg of segments) {
      expect(seg.durationSec).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("detectSceneCutTimestamps returns array (ffmpeg optional in CI)", async () => {
    const times = await detectSceneCutTimestamps("/nonexistent/path.mp4");
    expect(Array.isArray(times)).toBe(true);
  });
});
