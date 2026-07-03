import { describe, expect, it } from "vitest";

import { getQrAudioCatalog } from "@/lib/quick-replica/qr-audio-catalog";
import {
  normalizeVoiceControls,
  validateTextToAudioDraft,
} from "@/lib/quick-replica/qr-text-to-audio-models";

describe("qr-audio-catalog", () => {
  it("exposes MiniMax models and paged voices pointer", () => {
    const catalog = getQrAudioCatalog();
    expect(catalog.models.some((m) => m.modelKey.startsWith("MiniMax/"))).toBe(true);
    expect(catalog.voices.length).toBeGreaterThan(0);
    expect(catalog.styleTags.length).toBeGreaterThan(0);
    expect(catalog.defaults.modelKey).toBe("MiniMax/speech-2.8-hd");
    expect(catalog.voicesPaged).toBe(true);
  });

  it("validates voiceover draft", () => {
    expect(
      validateTextToAudioDraft({
        modelKey: "MiniMax/speech-2.8-hd",
        voiceId: "male-qn-qingse",
        prompt: "",
      }),
    ).toBe("请填写提示词");

    expect(
      validateTextToAudioDraft({
        modelKey: "MiniMax/speech-2.8-hd",
        voiceId: "male-qn-qingse",
        prompt: "Hello world",
      }),
    ).toBeNull();
  });

  it("normalizes six voice controls", () => {
    const controls = normalizeVoiceControls({
      voiceSpeed: 1.2,
      voiceVolume: 0.8,
      voicePitch: 2,
    });
    expect(controls.voiceSpeed).toBe(1.2);
    expect(controls.voiceVolume).toBe(0.8);
    expect(controls.voicePitch).toBe(2);
  });
});
