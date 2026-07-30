import { describe, expect, it } from "vitest";

import {
  buildAsrSubtitleSrt,
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
