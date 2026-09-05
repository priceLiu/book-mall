import { describe, expect, it } from "vitest";

import {
  audioDurationSecFromSentences,
  inferAsrAudioDurationSecFromLog,
} from "@/lib/finance/infer-asr-audio-duration";
import {
  inferS2vVideoSecondsFromLog,
  mergeS2vDurationIntoResultSummary,
} from "@/lib/finance/infer-s2v-video-seconds";

describe("inferAsrAudioDurationSecFromLog", () => {
  it("reads existing audioDurationSec", () => {
    expect(
      inferAsrAudioDurationSecFromLog({
        model: "qwen3-asr-flash-filetrans",
        resultSummary: { audioDurationSec: 42, sourceAudioDurationSec: 55, segmentCount: 3 },
      }),
    ).toBe(55);
  });

  it("infers from segments endMs", () => {
    expect(
      inferAsrAudioDurationSecFromLog({
        model: "qwen3-asr-flash-filetrans",
        resultSummary: {
          segmentCount: 2,
          segments: [
            { startMs: 0, endMs: 1500, text: "a" },
            { startMs: 1500, endMs: 4300, text: "b" },
          ],
        },
      }),
    ).toBe(5);
  });

  it("audioDurationSecFromSentences ceil seconds", () => {
    expect(
      audioDurationSecFromSentences([{ beginMs: 0, endMs: 1500, text: "x" }]),
    ).toBe(2);
  });
});

describe("inferS2vVideoSecondsFromLog", () => {
  it("reads usage.duration from resultSummary", () => {
    expect(
      inferS2vVideoSecondsFromLog({
        model: "wan2.2-s2v",
        resultSummary: { usage: { duration: 12, output_video_duration: 12 } },
      }),
    ).toBe(12);
  });

  it("falls back to compose audio duration", () => {
    expect(
      inferS2vVideoSecondsFromLog({
        model: "wan2.2-s2v",
        resultSummary: {},
        audioDurationSecFallback: 8,
      }),
    ).toBe(8);
  });

  it("mergeS2vDurationIntoResultSummary writes usage block", () => {
    const merged = mergeS2vDurationIntoResultSummary({}, 9, { videoUrl: "https://x" });
    expect(merged.usage).toMatchObject({ duration: 9, output_video_duration: 9 });
    expect(merged.videoUrl).toBe("https://x");
  });
});
