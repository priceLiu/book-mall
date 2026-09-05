import { describe, expect, it } from "vitest";

import {
  buildMinimaxVoicePreviewOssUrl,
  resolveLibtvVoicePreviewUrl,
} from "@/lib/canvas/libtv-voice-preview";

describe("resolveLibtvVoicePreviewUrl", () => {
  it("uses catalog previewUrl when present", () => {
    expect(
      resolveLibtvVoicePreviewUrl({
        previewUrl: "https://example.com/a.mp3",
        voiceId: "Serena",
        minimaxOssFallback: true,
      }),
    ).toBe("https://example.com/a.mp3");
  });

  it("does not invent MiniMax OSS url for Qwen voices", () => {
    expect(
      resolveLibtvVoicePreviewUrl({
        voiceId: "Serena",
        minimaxOssFallback: false,
      }),
    ).toBeUndefined();
  });

  it("allows MiniMax OSS fallback when enabled", () => {
    expect(
      resolveLibtvVoicePreviewUrl({
        voiceId: "male-qn-qingse",
        minimaxOssFallback: true,
      }),
    ).toBe(buildMinimaxVoicePreviewOssUrl("male-qn-qingse"));
  });
});
