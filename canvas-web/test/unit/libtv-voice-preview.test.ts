import { describe, expect, it } from "vitest";

import {
  buildMinimaxVoicePreviewOssUrl,
  resolveLibtvRowPreviewText,
  resolveLibtvVoicePreviewUrl,
  resolveMinimaxVoicePreviewText,
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

  it("keeps cached synth data URLs for audition replay", () => {
    const dataUrl = "data:audio/mpeg;base64,AAA";
    expect(
      resolveLibtvVoicePreviewUrl({
        previewUrl: dataUrl,
        voiceId: "Serena",
        minimaxOssFallback: false,
      }),
    ).toBe(dataUrl);
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

  it("resolveMinimaxVoicePreviewText matches OSS catalog script", () => {
    expect(resolveMinimaxVoicePreviewText("中文 (普通话)")).toBe(
      "你好，这是 MiniMax 语音试听。",
    );
    expect(resolveMinimaxVoicePreviewText("English")).toBe(
      "Hello, this is a MiniMax voice preview.",
    );
  });

  it("resolveLibtvRowPreviewText prefers each voice's own sample text", () => {
    expect(
      resolveLibtvRowPreviewText({
        sampleText: "Meet VisionX — your AI partner.",
        voiceLanguage: "English",
      }),
    ).toBe("Meet VisionX — your AI partner.");
    expect(
      resolveLibtvRowPreviewText({
        voiceLanguage: "中文 (普通话)",
      }),
    ).toBe("你好，这是 MiniMax 语音试听。");
  });
});
