import { describe, expect, it } from "vitest";

import {
  buildLibtvMinimaxTtsVoiceParamsSchema,
  libtvMinimaxTtsEmotionLabel,
  resolveLibtvMinimaxTtsEmotionOptions,
} from "@/lib/canvas/libtv-tts-voice-controls-schema";

describe("libtv-tts-voice-controls-schema", () => {
  it("exposes fluent on speech-2.8 and whisper only on 2.6", () => {
    const v28 = resolveLibtvMinimaxTtsEmotionOptions("MiniMax/speech-2.8-hd").map(
      (o) => o.value,
    );
    expect(v28).toContain("fluent");
    expect(v28).not.toContain("whisper");

    const v26 = resolveLibtvMinimaxTtsEmotionOptions("MiniMax/speech-2.6-hd").map(
      (o) => o.value,
    );
    expect(v26).toContain("fluent");
    expect(v26).toContain("whisper");
  });

  it("buildLibtvMinimaxTtsVoiceParamsSchema emotion select matches model", () => {
    const schema = buildLibtvMinimaxTtsVoiceParamsSchema("MiniMax/speech-2.6-hd");
    const emotion = schema.find((item) => item.key === "emotion");
    expect(emotion?.type).toBe("select");
    if (emotion?.type === "select") {
      expect(emotion.options.map((o) => o.value)).toContain("whisper");
    }
  });

  it("libtvMinimaxTtsEmotionLabel", () => {
    expect(libtvMinimaxTtsEmotionLabel("fluent")).toBe("旁白/流畅");
  });
});
