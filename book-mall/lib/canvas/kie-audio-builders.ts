import {
  isKieElevenLabsMarketModelKey,
  isKieSunoModelKey,
  KIE_ELEVENLABS_TTS_MODEL_KEY,
  KIE_ELEVENLABS_V3_MODEL_KEY,
  KIE_SUNO_API_MODEL_KEY,
} from "@/lib/gateway/kie-audio-models";

export function buildKieAudioCreateInput(args: {
  modelKey: string;
  prompt: string;
  params: Record<string, unknown>;
}): Record<string, unknown> {
  const modelKey = args.modelKey.trim();
  const text = args.prompt.trim();
  const params = args.params ?? {};

  if (modelKey === KIE_ELEVENLABS_V3_MODEL_KEY) {
    return {
      dialogue: [{ text }],
      stability:
        typeof params.stability === "number" ? params.stability : 0.5,
      ...(typeof params.language_code === "string" && params.language_code.trim()
        ? { language_code: params.language_code.trim() }
        : {}),
    };
  }

  if (modelKey === KIE_ELEVENLABS_TTS_MODEL_KEY) {
    return {
      text,
      voice: String(params.voice ?? "Rachel"),
      stability:
        typeof params.stability === "number" ? params.stability : 0.5,
      similarity_boost:
        typeof params.similarity_boost === "number"
          ? params.similarity_boost
          : 0.75,
    };
  }

  if (isKieSunoModelKey(modelKey)) {
    return {
      prompt: text,
      customMode: params.customMode === true,
      instrumental: params.instrumental === true,
      model: String(params.model ?? "V5"),
      ...(typeof params.style === "string" && params.style.trim()
        ? { style: params.style.trim() }
        : {}),
      ...(typeof params.title === "string" && params.title.trim()
        ? { title: params.title.trim() }
        : {}),
    };
  }

  if (isKieElevenLabsMarketModelKey(modelKey)) {
    return { text };
  }

  return { text };
}

export function kieAudioUsesSunoEndpoint(modelKey: string): boolean {
  return isKieSunoModelKey(modelKey);
}

export function normalizeKieAudioModelKey(modelKey: string): string {
  const k = modelKey.trim();
  if (isKieSunoModelKey(k)) return KIE_SUNO_API_MODEL_KEY;
  return k;
}
