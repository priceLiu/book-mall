import { describe, expect, it } from "vitest";

import { QWEN3_TTS_FLASH_VOICES } from "@/lib/ai-space/qwen3-tts-voice-catalog";
import { STORY_TTS_GATEWAY_MODELS } from "@/lib/canvas/providers/story-tts";

describe("story-tts qwen3 voice schema", () => {
  it("exposes full qwen3 flash voice catalog in params", () => {
    const qwen = STORY_TTS_GATEWAY_MODELS.find((m) => m.modelKey === "qwen3-tts");
    expect(qwen).toBeTruthy();
    const voiceField = qwen!.paramsSchema?.find((f) => f.key === "voice");
    expect(voiceField?.type).toBe("select");
    if (voiceField?.type !== "select") return;
    expect(voiceField.options.length).toBe(QWEN3_TTS_FLASH_VOICES.length);
    expect(voiceField.options[0]?.value).toBe("Cherry");
  });
});
