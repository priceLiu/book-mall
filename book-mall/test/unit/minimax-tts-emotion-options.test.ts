import { describe, expect, it } from "vitest";

import {
  minimaxTtsEmotionLabel,
  minimaxTtsEmotionOptionsForModelKey,
  resolveMinimaxTtsEmotionForModel,
} from "@/lib/gateway/minimax-tts-emotion-options";

describe("minimax-tts-emotion-options", () => {
  it("includes fluent on all speech models", () => {
    for (const modelKey of [
      "MiniMax/speech-2.8-hd",
      "MiniMax/speech-2.6-hd",
      "MiniMax/speech-02-hd",
    ]) {
      const values = minimaxTtsEmotionOptionsForModelKey(modelKey).map(
        (o) => o.value,
      );
      expect(values).toContain("fluent");
    }
  });

  it("whisper only on speech-2.6 models", () => {
    expect(
      minimaxTtsEmotionOptionsForModelKey("MiniMax/speech-2.6-hd").map(
        (o) => o.value,
      ),
    ).toContain("whisper");
    expect(
      minimaxTtsEmotionOptionsForModelKey("MiniMax/speech-2.8-hd").map(
        (o) => o.value,
      ),
    ).not.toContain("whisper");
  });

  it("resolveMinimaxTtsEmotionForModel strips whisper on 2.8", () => {
    expect(
      resolveMinimaxTtsEmotionForModel({
        modelKey: "MiniMax/speech-2.8-hd",
        emotionRaw: "whisper",
      }),
    ).toBeUndefined();
    expect(
      resolveMinimaxTtsEmotionForModel({
        modelKey: "MiniMax/speech-2.6-hd",
        emotionRaw: "whisper",
      }),
    ).toBe("whisper");
    expect(
      resolveMinimaxTtsEmotionForModel({
        modelKey: "MiniMax/speech-2.8-hd",
        emotionRaw: "fluent",
      }),
    ).toBe("fluent");
  });

  it("minimaxTtsEmotionLabel maps zh labels", () => {
    expect(minimaxTtsEmotionLabel("fluent")).toBe("旁白/流畅");
    expect(minimaxTtsEmotionLabel("whisper")).toBe("低语");
  });
});
