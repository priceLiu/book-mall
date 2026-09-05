import { describe, expect, it } from "vitest";

import {
  buildTtsAuditionPresetId,
  engineFromTtsAuditionPreset,
  exportTtsAuditionPresetToProjectAssetDraft,
  isActiveTtsAuditionPreset,
  LIBTV_TTS_AUDITION_PRESETS_MAX,
  paramsFromTtsAuditionPreset,
  upsertCanvasTtsAuditionPreset,
  type CanvasTtsAuditionPreset,
} from "@/lib/canvas/libtv-tts-audition-presets";

function preset(
  id: string,
  extra?: Partial<CanvasTtsAuditionPreset>,
): CanvasTtsAuditionPreset {
  return {
    id,
    label: id,
    variant: "minimax",
    providerId: "gw",
    modelKey: "speech-2.6-hd",
    voiceId: "v1",
    voiceLabel: "Voice 1",
    params: { emotion: "happy", speed: 1.1 },
    previewUrl: "data:audio/mpeg;base64,AAA",
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

describe("buildTtsAuditionPresetId", () => {
  it("changes when params change", () => {
    const a = buildTtsAuditionPresetId({
      modelKey: "speech-2.6-hd",
      voiceId: "abc",
      params: { speed: 1 },
    });
    const b = buildTtsAuditionPresetId({
      modelKey: "speech-2.6-hd",
      voiceId: "abc",
      params: { speed: 1.2 },
    });
    expect(a).not.toBe(b);
  });

  it("ignores billing flag in params", () => {
    const a = buildTtsAuditionPresetId({
      modelKey: "speech-2.6-hd",
      voiceId: "abc",
      params: { speed: 1, tts_param_preview_billing: true },
    });
    const b = buildTtsAuditionPresetId({
      modelKey: "speech-2.6-hd",
      voiceId: "abc",
      params: { speed: 1 },
    });
    expect(a).toBe(b);
  });
});

describe("upsertCanvasTtsAuditionPreset", () => {
  it("replaces same id and caps list", () => {
    const id = buildTtsAuditionPresetId({
      modelKey: "speech-2.6-hd",
      voiceId: "v1",
      params: { speed: 1 },
    });
    const prev = Array.from({ length: LIBTV_TTS_AUDITION_PRESETS_MAX }, (_, i) =>
      preset(`p${i}`),
    );
    const next = upsertCanvasTtsAuditionPreset(prev, preset(id, { label: "newer" }));
    expect(next).toHaveLength(LIBTV_TTS_AUDITION_PRESETS_MAX);
    expect(next[0]?.id).toBe(id);
    expect(next[0]?.label).toBe("newer");
  });
});

describe("paramsFromTtsAuditionPreset", () => {
  it("writes minimax voice_id fields", () => {
    expect(
      paramsFromTtsAuditionPreset(
        preset("x", {
          variant: "minimax",
          voiceId: "clone-1",
          voiceLabel: "Clone",
        }),
      ),
    ).toMatchObject({
      voice_id: "clone-1",
      voice_label: "Clone",
    });
  });

  it("writes qwen voice field", () => {
    expect(
      paramsFromTtsAuditionPreset(
        preset("x", { variant: "qwen", voiceId: "Cherry" }),
      ).voice,
    ).toBe("Cherry");
  });
});

describe("isActiveTtsAuditionPreset", () => {
  it("matches current node engine snapshot", () => {
    const row = preset("x", {
      params: { speed: 1.2, emotion: "happy" },
      voiceId: "abc",
    });
    row.id = buildTtsAuditionPresetId({
      modelKey: row.modelKey,
      voiceId: row.voiceId,
      params: row.params,
    });
    expect(
      isActiveTtsAuditionPreset(row, {
        variant: "minimax",
        providerId: "gw",
        modelKey: "speech-2.6-hd",
        voiceId: "abc",
        params: {
          speed: 1.2,
          emotion: "happy",
          voice_id: "abc",
        },
      }),
    ).toBe(true);
  });
});

describe("exportTtsAuditionPresetToProjectAssetDraft", () => {
  it("writes tts_voice_preset payload with engine", () => {
    const row = preset("x", { label: "女声 · 1.1x" });
    const draft = exportTtsAuditionPresetToProjectAssetDraft({
      preset: row,
      projectId: "p1",
      edition: "pro2",
    });
    expect(draft.kind).toBe("AUDIO");
    expect(draft.payload.assetSubtype).toBe("tts_voice_preset");
    expect(draft.payload.engine).toEqual(engineFromTtsAuditionPreset(row));
    expect(draft.payload.nodeType).toBe("story-pro2-audio");
  });
});
