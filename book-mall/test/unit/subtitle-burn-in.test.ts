import { describe, expect, it } from "vitest";
import { buildMergedSrt } from "@/lib/canvas/canvas-jianying-export";
import {
  computeSubtitleCueTimes,
  normalizeSubtitleBurnInText,
  splitDialogueIntoTimedCues,
} from "@/lib/media/subtitle-burn-in";

describe("normalizeSubtitleBurnInText", () => {
  it("picks dialogue line and strips scene headers", () => {
    const t = normalizeSubtitleBurnInText(
      "2 5s\n小红坐起来指着天空\n3 4s\n小蓝：你好",
    );
    expect(t).toBe("小蓝：你好");
  });

  it("returns empty for dash placeholder", () => {
    expect(normalizeSubtitleBurnInText("—")).toBe("");
  });
});

describe("buildMergedSrt xfade timing", () => {
  it("offsets cue starts when xfade transition is enabled", () => {
    const srt = buildMergedSrt(
      [
        { frameIndex: 1, dialogue: "A", durationSec: 5 },
        { frameIndex: 2, dialogue: "B", durationSec: 4 },
      ],
      { transitionType: "xfade", transitionSec: 0.6 },
    );
    expect(srt).toContain("00:00:00,000 --> 00:00:05,000");
    expect(srt).toContain("00:00:04,400 --> 00:00:08,400");
  });

  it("computeSubtitleCueTimes matches merged video offsets", () => {
    const cues = computeSubtitleCueTimes([5, 4, 3], {
      transitionType: "xfade",
      transitionSec: 0.6,
    });
    expect(cues[1]?.startSec).toBeCloseTo(4.4, 3);
    expect(cues[2]?.startSec).toBeCloseTo(7.8, 3);
  });

  it("splitDialogueIntoTimedCues splits sentences within clip window", () => {
    const cues = splitDialogueIntoTimedCues(
      "天空好蓝啊。等等，阳光是什么颜色？其实阳光里藏着彩虹。",
      0,
      8,
    );
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0]?.startSec).toBe(0);
    expect(cues[cues.length - 1]?.endSec).toBe(8);
    expect(cues.map((c) => c.text).join("")).toContain("天空好蓝");
  });

  it("splitDialogueIntoTimedCues splits long comma narration into short cues", () => {
    const cues = splitDialogueIntoTimedCues(
      "阳光里住着彩虹七兄弟，蓝光个子最小，被撞得满世界跑，所以我们到处都能看到蓝色。红光个子大，一路畅通无阻，所以日出日落时我们能感到红色。",
      0,
      12,
    );
    expect(cues.length).toBeGreaterThanOrEqual(4);
    expect(cues.every((c) => c.text.length <= 18)).toBe(true);
    expect(cues[0]?.startSec).toBe(0);
    expect(cues[cues.length - 1]?.endSec).toBe(12);
  });

  it("buildMergedSrt emits multiple cues for multi-sentence dialogue", () => {
    const srt = buildMergedSrt(
      [
        {
          frameIndex: 1,
          dialogue: "天空好蓝啊。等等，阳光是什么颜色？",
          durationSec: 6,
        },
      ],
      { transitionType: "none" },
    );
    expect(srt.split("\n\n").length).toBeGreaterThanOrEqual(2);
  });
});
