import { describe, expect, it } from "vitest";

import {
  collectLibtvDockEngineModels,
  isAllowedDockModelKey,
  modelMatchesDockGatewayRole,
} from "@/lib/canvas/libtv-dock-engine-models";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { GATEWAY_MINIMAX_VIDEO_PROVIDER_ID } from "@/lib/canvas/system-providers";
import { PRO2_TTS_MODEL_KEYS } from "@/lib/canvas/kie-audio-models";

function mockProvider(models: CanvasProviderDto["models"]): CanvasProviderDto {
  return {
    id: "gateway:bailian",
    alias: "Gateway · 百炼",
    kind: "OPENAI_COMPAT",
    baseUrl: null,
    apiKeyMasked: "gateway",
    active: true,
    lastTestedAt: null,
    lastTestStatus: "gateway",
    models,
    createdAt: "",
    updatedAt: "",
  };
}

describe("libtv-dock-engine-models · Gateway TTS role", () => {
  it("matches LLM-registered qwen3-tts when Dock role is TTS", () => {
    expect(
      modelMatchesDockGatewayRole(
        { role: "LLM", modelKey: "qwen3-tts" },
        "TTS",
        new Set(PRO2_TTS_MODEL_KEYS),
      ),
    ).toBe(true);
  });

  it("matches LLM-registered MiniMax Speech when Dock role is TTS", () => {
    expect(
      modelMatchesDockGatewayRole(
        { role: "LLM", modelKey: "MiniMax/speech-2.8-hd" },
        "TTS",
        new Set(PRO2_TTS_MODEL_KEYS),
      ),
    ).toBe(true);
  });

  it("collectLibtvDockEngineModels returns Gateway TTS models", () => {
    const providers = [
      mockProvider([
        {
          id: "gateway:bailian::qwen3-tts",
          modelKey: "qwen3-tts",
          displayName: "Qwen3 TTS",
          role: "LLM",
          description: null,
          paramsSchema: null,
          defaultParams: { voice: "Cherry" },
          enabled: true,
          sortOrder: 0,
        },
        {
          id: "gateway:kie::elevenlabs/text-to-dialogue-v3",
          modelKey: "elevenlabs/text-to-dialogue-v3",
          displayName: "ElevenLabs V3",
          role: "LLM",
          description: null,
          paramsSchema: null,
          defaultParams: null,
          enabled: true,
          sortOrder: 1,
        },
      ]),
    ];

    const entries = collectLibtvDockEngineModels(providers, {
      role: "TTS",
      allowedModelKeys: [...PRO2_TTS_MODEL_KEYS],
    });

    expect(entries.map((e) => e.model.modelKey)).toEqual([
      "qwen3-tts",
      "elevenlabs/text-to-dialogue-v3",
    ]);
  });

  it("collectLibtvDockEngineModels includes MiniMax Speech models", () => {
    const providers = [
      mockProvider([
        {
          id: `${GATEWAY_MINIMAX_VIDEO_PROVIDER_ID}::MiniMax/speech-2.8-hd`,
          modelKey: "MiniMax/speech-2.8-hd",
          displayName: "MiniMax Speech 2.8 HD",
          role: "LLM",
          description: null,
          paramsSchema: null,
          defaultParams: { voice_id: "male-qn-qingse" },
          enabled: true,
          sortOrder: 0,
        },
      ]),
    ];

    const entries = collectLibtvDockEngineModels(providers, {
      role: "TTS",
      allowedModelKeys: [...PRO2_TTS_MODEL_KEYS],
    });

    expect(entries.map((e) => e.model.modelKey)).toEqual([
      "MiniMax/speech-2.8-hd",
    ]);
  });

  it("isAllowedDockModelKey is case-insensitive", () => {
    const allowed = new Set(["qwen3-tts"]);
    expect(isAllowedDockModelKey("QWEN3-TTS", allowed)).toBe(true);
    expect(isAllowedDockModelKey("gpt-4", allowed)).toBe(false);
  });
});
