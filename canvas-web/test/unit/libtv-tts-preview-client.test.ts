import { describe, expect, it } from "vitest";

import {
  buildLibtvTtsPreviewCacheKey,
  buildLibtvTtsRowPreviewContextFromSpec,
  buildLibtvTtsVoiceRowPreviewContext,
  hasAdjustedLibtvTtsParams,
  isLibtvTtsParamPreviewBillingEnabled,
  isLibtvTtsRowPreviewActive,
  LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY,
  pickLibtvTtsPreviewParams,
  shouldUseLibtvDynamicTtsPreview,
  stripLibtvTtsRowVoiceParams,
} from "@/lib/canvas/libtv-tts-preview-client";

describe("libtv-tts-preview-client", () => {
  it("hasAdjustedLibtvTtsParams detects vol/speed/emotion changes", () => {
    expect(hasAdjustedLibtvTtsParams({})).toBe(false);
    expect(hasAdjustedLibtvTtsParams({ vol: 1.44 })).toBe(true);
    expect(hasAdjustedLibtvTtsParams({ emotion: "fluent" })).toBe(true);
    expect(hasAdjustedLibtvTtsParams({ speed: "1" })).toBe(false);
  });

  it("stripLibtvTtsRowVoiceParams removes dock-selected voice fields", () => {
    expect(
      stripLibtvTtsRowVoiceParams({
        voice_id: "selected-voice",
        voice: "selected-voice",
        voice_label: "已选音色",
        speed: 1.35,
        emotion: "fluent",
      }),
    ).toEqual({ speed: 1.35, emotion: "fluent" });
  });

  it("isLibtvTtsParamPreviewBillingEnabled reads billing flag", () => {
    expect(isLibtvTtsParamPreviewBillingEnabled({})).toBe(false);
    expect(
      isLibtvTtsParamPreviewBillingEnabled({
        [LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY]: true,
      }),
    ).toBe(true);
  });

  it("shouldUseLibtvDynamicTtsPreview uses rowParamPreview flag", () => {
    expect(
      shouldUseLibtvDynamicTtsPreview(
        {
          modelKey: "MiniMax/speech-02-hd",
          params: {},
          rowParamPreview: true,
        },
        "voice-a",
        { minimaxOssFallback: true },
      ),
    ).toBe(true);
  });

  it("shouldUseLibtvDynamicTtsPreview uses OSS when MiniMax billing off", () => {
    const ctx = { modelKey: "MiniMax/speech-02-hd", params: { speed: 1 } };
    expect(
      shouldUseLibtvDynamicTtsPreview(ctx, "male-qn-qingse", {
        minimaxOssFallback: true,
      }),
    ).toBe(false);
    expect(
      shouldUseLibtvDynamicTtsPreview(
        {
          ...ctx,
          params: {
            speed: 1,
            [LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY]: true,
          },
        },
        "male-qn-qingse",
        { minimaxOssFallback: true },
      ),
    ).toBe(true);
    expect(
      shouldUseLibtvDynamicTtsPreview(
        {
          ...ctx,
          params: {
            vol: 1.5,
            [LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY]: true,
          },
        },
        "another-voice-id",
        { minimaxOssFallback: true },
      ),
    ).toBe(true);
  });

  it("shouldUseLibtvDynamicTtsPreview for Qwen requires billing when adjusted", () => {
    expect(
      shouldUseLibtvDynamicTtsPreview(
        { modelKey: "qwen3-tts-flash", params: {} },
        "Cherry",
        { minimaxOssFallback: false },
      ),
    ).toBe(true);
    expect(
      shouldUseLibtvDynamicTtsPreview(
        {
          modelKey: "qwen3-tts-flash",
          params: { speed: 1.2 },
        },
        "Cherry",
        { minimaxOssFallback: false },
      ),
    ).toBe(false);
    expect(
      shouldUseLibtvDynamicTtsPreview(
        {
          modelKey: "qwen3-tts-flash",
          params: {
            speed: 1.2,
            [LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY]: true,
          },
        },
        "Cherry",
        { minimaxOssFallback: false },
      ),
    ).toBe(true);
  });

  it("buildLibtvTtsRowPreviewContextFromSpec strips dock voice and marks row preview", () => {
    expect(
      buildLibtvTtsRowPreviewContextFromSpec({
        modelKey: "MiniMax/speech-02-hd",
        dockParams: {
          voice_id: "dock-voice",
          speed: 1.35,
          emotion: "fluent",
          [LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY]: true,
        },
      }),
    ).toEqual({
      modelKey: "MiniMax/speech-02-hd",
      params: { speed: 1.35, emotion: "fluent" },
      rowParamPreview: true,
      billable: true,
    });
  });

  it("isLibtvTtsRowPreviewActive accepts billing flag from params or local state", () => {
    expect(isLibtvTtsRowPreviewActive({})).toBe(false);
    expect(
      isLibtvTtsRowPreviewActive({
        params: { [LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY]: true },
      }),
    ).toBe(true);
    expect(
      isLibtvTtsRowPreviewActive({ billingPreviewEnabled: true, params: {} }),
    ).toBe(true);
  });

  it("buildLibtvTtsVoiceRowPreviewContext enables MiniMax row preview when billing on", () => {
    const base = { modelKey: "MiniMax/speech-02-hd", params: {} };
    expect(
      buildLibtvTtsVoiceRowPreviewContext(base, { speed: 1 }, {
        minimaxOssFallback: true,
      }),
    ).toBeUndefined();
    expect(
      buildLibtvTtsVoiceRowPreviewContext(
        base,
        {
          voice_id: "dock-selected",
          speed: 1.2,
        },
        { minimaxOssFallback: true, billingEnabled: true },
      ),
    ).toEqual({
      modelKey: "MiniMax/speech-02-hd",
      params: {
        speed: 1.2,
      },
      rowParamPreview: true,
      billable: true,
    });
  });

  it("buildLibtvTtsPreviewCacheKey includes params and voiceId", () => {
    const a = buildLibtvTtsPreviewCacheKey({
      modelKey: "MiniMax/speech-02-hd",
      voiceId: "v1",
      params: { speed: 1.1, emotion: "happy" },
    });
    const b = buildLibtvTtsPreviewCacheKey({
      modelKey: "MiniMax/speech-02-hd",
      voiceId: "v2",
      params: { speed: 1.1, emotion: "happy" },
    });
    expect(a).not.toBe(b);
  });

  it("pickLibtvTtsPreviewParams keeps TTS keys only", () => {
    expect(
      pickLibtvTtsPreviewParams({
        voice_id: "male-qn-qingse",
        voice_label: "青涩青年",
        speed: 1.4,
        vol: 0.8,
        emotion: "happy",
        [LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY]: true,
        foo: "bar",
      }),
    ).toEqual({
      speed: 1.4,
      vol: 0.8,
      emotion: "happy",
    });
  });
});
