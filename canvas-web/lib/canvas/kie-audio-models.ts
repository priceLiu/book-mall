import type { CanvasEnginePick } from "./types";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";

export const KIE_SUNO_API_MODEL_KEY = "suno/generate" as const;

export const KIE_ELEVENLABS_V3_MODEL_KEY =
  "elevenlabs/text-to-dialogue-v3" as const;

export const KIE_ELEVENLABS_TTS_MODEL_KEY =
  "elevenlabs/text-to-speech-multilingual-v2" as const;

export const PRO2_SUNO_MODEL_KEYS = [KIE_SUNO_API_MODEL_KEY] as const;

export const PRO2_TTS_MODEL_KEYS = [
  KIE_ELEVENLABS_V3_MODEL_KEY,
  KIE_ELEVENLABS_TTS_MODEL_KEY,
] as const;

const SUNO_SET = new Set<string>(PRO2_SUNO_MODEL_KEYS);
const TTS_SET = new Set<string>(PRO2_TTS_MODEL_KEYS);

export function isPro2SunoModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return SUNO_SET.has(k) || k.startsWith("suno/");
}

export function isPro2TtsModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return TTS_SET.has(k) || k.startsWith("elevenlabs/");
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
