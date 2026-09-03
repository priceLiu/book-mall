import { describe, expect, it } from "vitest";

import {
  batchComposeButtonLabel,
  batchTtsButtonLabel,
  isSeedVideoShotComposeReady,
  listSelectedComposeShotIndices,
  listSelectedTtsShotIndices,
} from "@/lib/seed-video-tts-selection";
import type { SeedVideoShot } from "@/lib/seed-video-types";

const shots: SeedVideoShot[] = [
  {
    index: 1,
    timeSlice: "0-3s",
    refImageId: "",
    refImageLabel: "",
    sceneDescription: "",
    videoPrompt: "",
    voiceover: "hello",
  },
  {
    index: 2,
    timeSlice: "3-6s",
    refImageId: "",
    refImageLabel: "",
    sceneDescription: "",
    videoPrompt: "",
    voiceover: "",
  },
  {
    index: 3,
    timeSlice: "6-9s",
    refImageId: "",
    refImageLabel: "",
    sceneDescription: "",
    videoPrompt: "",
    voiceover: "world",
  },
];

describe("seed-video-tts-selection", () => {
  it("lists only selected shots with voiceover", () => {
    expect(listSelectedTtsShotIndices(shots, [1, 2, 3])).toEqual([1, 3]);
  });

  it("formats batch TTS button label with count", () => {
    expect(batchTtsButtonLabel({ selectedCount: 0 })).toBe("批量 TTS");
    expect(batchTtsButtonLabel({ selectedCount: 2 })).toBe("批量 TTS (2)");
    expect(batchTtsButtonLabel({ busy: true, selectedCount: 2 })).toBe("TTS…");
  });

  it("lists compose-ready selected shots", () => {
    const withVideo = { ...shots[0]!, videoUrl: "https://example.com/v.mp4" };
    const ready = {
      ...shots[2]!,
      videoUrl: "https://example.com/v2.mp4",
      ttsUrl: "https://example.com/a.mp3",
    };
    const all = [withVideo, shots[1]!, ready];
    expect(listSelectedComposeShotIndices(all, [1, 2, 3])).toEqual([3]);
    expect(isSeedVideoShotComposeReady(withVideo)).toBe(false);
    expect(isSeedVideoShotComposeReady(ready)).toBe(true);
  });

  it("formats batch compose button label with count", () => {
    expect(batchComposeButtonLabel({ selectedCount: 0 })).toBe("合成成片");
    expect(batchComposeButtonLabel({ selectedCount: 3 })).toBe("合成成片 (3)");
    expect(batchComposeButtonLabel({ busy: true, selectedCount: 3 })).toBe("合成中…");
  });
});
