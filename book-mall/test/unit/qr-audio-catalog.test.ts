import { describe, expect, it } from "vitest";

import { getQrAudioCatalog } from "@/lib/quick-replica/qr-audio-catalog";
import { validateTextToAudioDraft } from "@/lib/quick-replica/qr-text-to-audio-models";

describe("qr-audio-catalog", () => {
  it("exposes models voices and defaults", () => {
    const catalog = getQrAudioCatalog();
    expect(catalog.models.length).toBeGreaterThan(0);
    expect(catalog.voices.length).toBeGreaterThan(0);
    expect(catalog.styleTags.length).toBeGreaterThan(0);
    expect(catalog.defaults.modelKey).toBe("eleven_multilingual_v2");
  });

  it("validates voiceover draft", () => {
    expect(
      validateTextToAudioDraft({
        modelKey: "eleven_multilingual_v2",
        voiceId: "khanh-tu",
        prompt: "",
      }),
    ).toBe("请填写提示词");

    expect(
      validateTextToAudioDraft({
        modelKey: "eleven_multilingual_v2",
        voiceId: "khanh-tu",
        prompt: "Hello world",
      }),
    ).toBeNull();
  });
});
