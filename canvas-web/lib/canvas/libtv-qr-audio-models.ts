import type { CanvasEnginePick } from "./types";
import {
  GATEWAY_KIE_PROVIDER_ID,
  GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
} from "./system-providers";

export type LibtvQrAudioCatalogModel = {
  modelKey: string;
  label: string;
  subtitle: string;
  provider: string;
};

/** 与快速复制「旁白 / Create Voiceover」一致的 TTS 模型（不含音乐/音效/变声） */
export function isQrVoiceoverModel(model: LibtvQrAudioCatalogModel): boolean {
  const key = model.modelKey.trim().toLowerCase();
  if (model.provider === "minimax") {
    return key.includes("speech");
  }
  if (model.provider === "elevenlabs") {
    return (
      key.includes("text-to-speech") ||
      key.includes("text-to-dialogue")
    );
  }
  return false;
}

export function isMinimaxSpeechModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k.includes("minimax/speech") || k.startsWith("speech-");
}

export function resolveQrAudioProviderId(model: LibtvQrAudioCatalogModel): string {
  if (model.provider === "minimax") return GATEWAY_MINIMAX_VIDEO_PROVIDER_ID;
  if (model.provider === "elevenlabs") return GATEWAY_KIE_PROVIDER_ID;
  return GATEWAY_MINIMAX_VIDEO_PROVIDER_ID;
}

export function buildQrVoiceoverEnginePick(
  model: LibtvQrAudioCatalogModel,
  defaults?: { voiceId?: string },
): CanvasEnginePick {
  const params: Record<string, unknown> = {};
  if (isMinimaxSpeechModelKey(model.modelKey) && defaults?.voiceId?.trim()) {
    params.voice_id = defaults.voiceId.trim();
  }
  if (model.provider === "elevenlabs" && defaults?.voiceId?.trim()) {
    params.voice = defaults.voiceId.trim();
  }
  return {
    providerId: resolveQrAudioProviderId(model),
    modelKey: model.modelKey,
    params,
  };
}

export function pickDefaultQrVoiceoverEngine(
  models: LibtvQrAudioCatalogModel[],
  defaults?: { modelKey?: string; voiceId?: string },
): CanvasEnginePick | null {
  const voiceover = models.filter(isQrVoiceoverModel);
  if (voiceover.length === 0) return null;
  const preferredKey = defaults?.modelKey?.trim();
  const hit =
    (preferredKey
      ? voiceover.find((m) => m.modelKey === preferredKey)
      : undefined) ?? voiceover[0]!;
  return buildQrVoiceoverEnginePick(hit, defaults);
}
