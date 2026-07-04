import { describe, expect, it } from "vitest";

import {
  generateQrCloneVoiceId,
  normalizeVoiceEmotionWeights,
  resolveDominantVoiceEmotion,
  validateVoiceCloneDraft,
} from "@/lib/quick-replica/qr-voice-clone-models";

describe("qr-voice-clone-models", () => {
  it("validates voice clone draft", () => {
    expect(
      validateVoiceCloneDraft({
        modelKey: "MiniMax/speech-2.8-hd",
        referenceAudioUrl: "https://example.com/a.mp3",
        prompt: "你好",
      }),
    ).toBeNull();
    expect(
      validateVoiceCloneDraft({
        modelKey: "MiniMax/speech-02-hd",
        referenceAudioUrl: "https://example.com/a.mp3",
        prompt: "你好",
      }),
    ).toMatch(/模型/);
  });

  it("generates clone voice id", () => {
    const id = generateQrCloneVoiceId();
    expect(id.startsWith("QrClone_")).toBe(true);
    expect(id.length).toBeGreaterThanOrEqual(8);
  });

  it("caps emotion weights total", () => {
    const normalized = normalizeVoiceEmotionWeights({
      happy: 1,
      angry: 1,
      sad: 0.5,
    });
    const total = Object.values(normalized).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(1.5);
    expect(resolveDominantVoiceEmotion(normalized)).toBe("happy");
  });
});
