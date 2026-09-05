import { describe, expect, it } from "vitest";

import {
  buildPro2AudioTtsInputHash,
  readCanvasTtsNumericParam,
  resolveCanvasMinimaxTtsVoiceInput,
  resolveCanvasGatewayTtsExtras,
} from "@/lib/canvas/canvas-tts-run-params";

describe("canvas-tts-run-params", () => {
  it("readCanvasTtsNumericParam accepts string numbers from persisted canvas", () => {
    expect(readCanvasTtsNumericParam({ speed: "1.35" }, "speed")).toBe(1.35);
    expect(readCanvasTtsNumericParam({ vol: 0.8 }, "vol")).toBe(0.8);
  });

  it("resolveCanvasMinimaxTtsVoiceInput maps emotion and numeric params", () => {
    expect(
      resolveCanvasMinimaxTtsVoiceInput(
        { speed: "1.2", vol: "0.9", pitch: "-2", emotion: "happy" },
        "male-qn-qingse",
        "MiniMax/speech-2.8-hd",
      ),
    ).toEqual({
      voice_id: "male-qn-qingse",
      speed: 1.2,
      vol: 0.9,
      pitch: -2,
      emotion: "happy",
    });
  });

  it("resolveCanvasMinimaxTtsVoiceInput drops whisper on speech-2.8", () => {
    expect(
      resolveCanvasMinimaxTtsVoiceInput(
        { emotion: "whisper" },
        "male-qn-qingse",
        "MiniMax/speech-2.8-hd",
      ),
    ).toEqual({ voice_id: "male-qn-qingse" });
    expect(
      resolveCanvasMinimaxTtsVoiceInput(
        { emotion: "fluent" },
        "male-qn-qingse",
        "MiniMax/speech-2.8-hd",
      ),
    ).toEqual({ voice_id: "male-qn-qingse", emotion: "fluent" });
  });

  it("resolveCanvasGatewayTtsExtras maps qwen instruction and volume", () => {
    expect(
      resolveCanvasGatewayTtsExtras({
        speed: "1.1",
        pitch: 1,
        vol: 0.7,
        instruction: " 语速稍快 ",
      }),
    ).toEqual({
      speed: 1.1,
      pitch: 1,
      volume: 0.7,
      instruction: "语速稍快",
    });
  });

  it("buildPro2AudioTtsInputHash changes when TTS params change", () => {
    const base = {
      modelKey: "MiniMax/speech-02-hd",
      voiceId: "male-qn-qingse",
      text: "hello",
      params: { speed: 1, emotion: "" },
    };
    const a = buildPro2AudioTtsInputHash(base);
    const b = buildPro2AudioTtsInputHash({
      ...base,
      params: { speed: 1.3, emotion: "happy" },
    });
    expect(a).not.toBe(b);
  });
});
