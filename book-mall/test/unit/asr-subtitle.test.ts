import { describe, expect, it } from "vitest";

import {
  buildAsrSubtitleSrt,
  buildAsrSubtitleSrtFromClipScriptFallback,
  buildAsrSubtitleSrtFromGlobalSegments,
  buildMediaRenderAsrCacheKey,
  expandAsrSegmentToBurnInCues,
} from "@/lib/media/asr-subtitle";

describe("buildAsrSubtitleSrt", () => {
  it("merges clip segments with xfade timeline offsets", () => {
    const srt = buildAsrSubtitleSrt(
      [
        [{ startMs: 500, endMs: 2000, text: "第一句" }],
        [{ startMs: 300, endMs: 1800, text: "第二句" }],
      ],
      [4, 5],
      { transitionType: "xfade", transitionSec: 0.6 },
    );
    expect(srt).toContain("第一句");
    expect(srt).toContain("第二句");
    expect(srt).toMatch(/--> /);
    expect(srt.split("\n\n").length).toBeGreaterThanOrEqual(2);
  });

  it("skips empty segments", () => {
    const srt = buildAsrSubtitleSrt([[{ startMs: 0, endMs: 1000, text: "  " }]], [3]);
    expect(srt.trim()).toBe("");
  });

  it("builds global timeline srt from merged asr segments", () => {
    const srt = buildAsrSubtitleSrtFromGlobalSegments([
      { startMs: 1200, endMs: 3400, text: "你好世界" },
      { startMs: 8000, endMs: 10500, text: "第二句" },
    ]);
    expect(srt).toContain("你好世界");
    expect(srt).toContain("第二句");
    expect(srt).toMatch(/00:00:01,200 --> 00:00:03,400/);
  });

  it("falls back to clip script when asr empty", () => {
    const srt = buildAsrSubtitleSrtFromClipScriptFallback({
      clipSubtitles: ["镜一", undefined, "镜三"],
      mergeDurationsSec: [4, 5, 6],
    });
    expect(srt).toContain("镜一");
    expect(srt).toContain("镜三");
    expect(srt).not.toContain("镜二");
  });

  it("builds stable cache keys for same timeline", () => {
    const a = buildMediaRenderAsrCacheKey({
      clipVideoUrls: ["https://a/1.mp4", "https://a/2.mp4"],
      mergeDurationsSec: [4, 5.001],
      modelKey: "qwen3-asr-flash-filetrans",
      transitionType: "xfade",
      transitionSec: 0.6,
    });
    const b = buildMediaRenderAsrCacheKey({
      clipVideoUrls: ["https://a/1.mp4", "https://a/2.mp4"],
      mergeDurationsSec: [4, 5.001],
      modelKey: "qwen3-asr-flash-filetrans",
      transitionType: "xfade",
      transitionSec: 0.6,
    });
    expect(a).toBe(b);
  });

  it("chunks long ASR sentence into short timed cues within vendor window", () => {
    const cues = expandAsrSegmentToBurnInCues(
      {
        startMs: 200,
        endMs: 8200,
        text: "阳光里住着彩虹七兄弟，蓝光个子最小，被撞得满世界跑，所以我们到处都能看到蓝色。",
      },
      0,
    );
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues[0]?.startSec).toBeCloseTo(0.2, 3);
    expect(cues[cues.length - 1]?.endSec).toBeCloseTo(8.2, 3);
    expect(cues.every((c) => c.text.length <= 18)).toBe(true);
    expect(cues.map((c) => c.text).join("")).toContain("彩虹七兄弟");
  });
});
