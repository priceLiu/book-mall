import type { CanvasEnginePick } from "./types";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { STORY_TTS_MODEL_KEYS } from "./story-prompts";
import { isMinimaxSpeechModelKey } from "./libtv-qr-audio-models";
import { applyLibtvTtsVoicePreferenceToParams } from "./libtv-tts-voice-preference";

export const KIE_SUNO_API_MODEL_KEY = "suno/generate" as const;

export const KIE_ELEVENLABS_V3_MODEL_KEY =
  "elevenlabs/text-to-dialogue-v3" as const;

export const KIE_ELEVENLABS_TTS_MODEL_KEY =
  "elevenlabs/text-to-speech-multilingual-v2" as const;

export const PRO2_SUNO_MODEL_KEYS = [KIE_SUNO_API_MODEL_KEY] as const;

/** 与快速复制 / AI 空间默认旁白音色一致 */
export const DEFAULT_LIBTV_MINIMAX_VOICE_ID = "male-qn-qingse";

/** MiniMax Speech · 与 AI 空间 / 快速复制旁白一致 */
export const PRO2_MINIMAX_SPEECH_MODEL_KEYS = [
  "MiniMax/speech-2.8-hd",
  "MiniMax/speech-2.8-turbo",
  "MiniMax/speech-2.6-hd",
  "MiniMax/speech-2.6-turbo",
  "MiniMax/speech-02-hd",
  "MiniMax/speech-02-turbo",
] as const;

/** Gateway 同步 TTS + MiniMax Speech + KIE ElevenLabs TTS（Dock 模型白名单） */
export const PRO2_TTS_MODEL_KEYS = [
  ...PRO2_MINIMAX_SPEECH_MODEL_KEYS,
  ...STORY_TTS_MODEL_KEYS,
  KIE_ELEVENLABS_V3_MODEL_KEY,
  KIE_ELEVENLABS_TTS_MODEL_KEY,
] as const;

const SUNO_SET = new Set<string>(PRO2_SUNO_MODEL_KEYS.map((k) => k.toLowerCase()));
const TTS_SET = new Set<string>(PRO2_TTS_MODEL_KEYS.map((k) => k.toLowerCase()));
const GATEWAY_TTS_SET = new Set<string>(STORY_TTS_MODEL_KEYS.map((k) => k.toLowerCase()));

export function isPro2SunoModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return SUNO_SET.has(k) || k.startsWith("suno/");
}

export function isPro2GatewaySyncTtsModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return GATEWAY_TTS_SET.has(k);
}

export function isPro2TtsModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    TTS_SET.has(k) ||
    k.startsWith("elevenlabs/") ||
    isMinimaxSpeechModelKey(modelKey) ||
    isPro2GatewaySyncTtsModelKey(k)
  );
}

export function pickDefaultPro2SunoEngine(
  providers: CanvasProviderDto[],
): CanvasEnginePick | null {
  for (const p of providers) {
    for (const m of p.models ?? []) {
      if (isPro2SunoModelKey(m.modelKey)) {
        return {
          providerId: p.id,
          modelKey: m.modelKey,
          params: { ...(m.defaultParams ?? {}) },
        };
      }
    }
  }
  return null;
}

export function pickDefaultPro2TtsEngine(
  providers: CanvasProviderDto[],
): CanvasEnginePick | null {
  const preferred = [
    "MiniMax/speech-2.8-hd",
    "MiniMax/speech-2.8-turbo",
    "qwen3-tts",
    ...PRO2_TTS_MODEL_KEYS,
  ];
  for (const key of preferred) {
    for (const p of providers) {
      for (const m of p.models ?? []) {
        if (m.modelKey.toLowerCase() === key.toLowerCase() && isPro2TtsModelKey(m.modelKey)) {
          let params = { ...(m.defaultParams ?? {}) };
          if (
            isMinimaxSpeechModelKey(m.modelKey) &&
            !String(params.voice_id ?? "").trim()
          ) {
            params.voice_id = DEFAULT_LIBTV_MINIMAX_VOICE_ID;
          }
          params = applyLibtvTtsVoicePreferenceToParams(m.modelKey, params);
          return {
            providerId: p.id,
            modelKey: m.modelKey,
            params,
          };
        }
      }
    }
  }
  for (const p of providers) {
    for (const m of p.models ?? []) {
      if (isPro2TtsModelKey(m.modelKey)) {
        return {
          providerId: p.id,
          modelKey: m.modelKey,
          params: { ...(m.defaultParams ?? {}) },
        };
      }
    }
  }
  return null;
}
