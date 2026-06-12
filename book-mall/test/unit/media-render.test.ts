import { describe, expect, it } from "vitest";

import { buildMergedSrt } from "@/lib/canvas/canvas-jianying-export";
import {
  fromCanvasJianyingFrames,
  fromEcomStoryboardSheet,
} from "@/lib/media/timeline-adapters";
import {
  MEDIA_RENDER_MAX_CLIPS,
  validateTimelineLimits,
} from "@/lib/media/render-limits";
import { timelineToSrtFrames } from "@/lib/media/render-ffmpeg";
import type { StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";

describe("media render adapters", () => {
  it("fromCanvasJianyingFrames maps video clips in order", () => {
    const tl = fromCanvasJianyingFrames([
      { frameIndex: 2, videoUrl: "https://cdn/a.mp4", dialogue: "B" },
      { frameIndex: 1, videoUrl: "https://cdn/b.mp4", dialogue: "A" },
    ]);
    expect(tl.clips).toHaveLength(2);
    expect(tl.clips[0]?.videoUrl).toBe("https://cdn/b.mp4");
    expect(tl.clips[1]?.subtitle).toBe("B");
  });

  it("fromEcomStoryboardSheet skips panels without video", () => {
    const sheet: StoryboardSheet = {
      overview: { title: "T", logline: "L" },
      cast: [],
      panels: [
        {
          index: 1,
          shotType: "CU",
          scene: "s",
          action: "a",
          videoUrl: "https://cdn/1.mp4",
          dialogue: "hi",
        },
        {
          index: 2,
          shotType: "CU",
          scene: "s",
          action: "a",
        },
      ],
    };
    const tl = fromEcomStoryboardSheet(sheet);
    expect(tl.clips).toHaveLength(1);
    expect(tl.clips[0]?.subtitle).toBe("hi");
  });
});

describe("render limits", () => {
  it("rejects too many clips", () => {
    const clips = Array.from({ length: MEDIA_RENDER_MAX_CLIPS + 1 }, (_, i) => ({
      order: i,
      videoUrl: `https://cdn/${i}.mp4`,
    }));
    const err = validateTimelineLimits({ version: 1, clips });
    expect(err?.code).toBe("TOO_MANY_CLIPS");
  });

  it("rejects non-https urls", () => {
    const err = validateTimelineLimits({
      version: 1,
      clips: [{ order: 0, videoUrl: "http://insecure.mp4" }],
    });
    expect(err?.code).toBe("INVALID_VIDEO_URL");
  });
});

describe("SRT timing with probed durations", () => {
  it("uses ffprobe durations instead of default 3s", () => {
    const frames = timelineToSrtFrames(
      {
        version: 1,
        clips: [
          { order: 0, videoUrl: "https://cdn/1.mp4", subtitle: "A" },
          { order: 1, videoUrl: "https://cdn/2.mp4", subtitle: "B" },
        ],
      },
      [4.5, 2.0],
    );
    const srt = buildMergedSrt(frames);
    expect(srt).toContain("00:00:00,000 --> 00:00:04,500");
    expect(srt).toContain("00:00:04,500 --> 00:00:06,500");
  });
});
