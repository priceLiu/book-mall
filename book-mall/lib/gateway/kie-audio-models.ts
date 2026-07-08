/** KIE Market · 音频模型（文生音乐 / 文生语音） */

export const KIE_SUNO_API_MODEL_KEY = "suno/generate" as const;

export const KIE_ELEVENLABS_V3_MODEL_KEY =
  "elevenlabs/text-to-dialogue-v3" as const;

export const KIE_ELEVENLABS_TTS_MODEL_KEY =
  "elevenlabs/text-to-speech-multilingual-v2" as const;

export const KIE_AUDIO_MODEL_KEYS = [
  KIE_SUNO_API_MODEL_KEY,
  KIE_ELEVENLABS_V3_MODEL_KEY,
  KIE_ELEVENLABS_TTS_MODEL_KEY,
] as const;

const SUNO_KEYS = new Set([KIE_SUNO_API_MODEL_KEY.toLowerCase()]);
const ELEVEN_KEYS = new Set([
  KIE_ELEVENLABS_V3_MODEL_KEY.toLowerCase(),
  KIE_ELEVENLABS_TTS_MODEL_KEY.toLowerCase(),
]);

export function isKieSunoModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return SUNO_KEYS.has(k) || k.startsWith("suno/");
}

export function isKieElevenLabsMarketModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return ELEVEN_KEYS.has(k) || k.startsWith("elevenlabs/");
}

export const KIE_SUNO_GATEWAY_MODEL = {
  modelKey: KIE_SUNO_API_MODEL_KEY,
  displayName: "Suno API",
  label: "Suno API",
  subtitle: "KIE · 文生音乐 · Suno V5 系列",
  role: "LLM" as const,
  paramsSchema: [
    {
      key: "instrumental",
      label: "纯音乐",
      type: "checkbox" as const,
      defaultValue: false,
    },
    {
      key: "model",
      label: "Suno 版本",
      type: "select" as const,
      options: [
        { value: "V5", label: "V5" },
        { value: "V4_5PLUS", label: "V4.5 Plus" },
        { value: "V4_5", label: "V4.5" },
      ],
      defaultValue: "V5",
    },
  ],
  defaultParams: { instrumental: false, model: "V5" },
};

export const KIE_ELEVENLABS_V3_GATEWAY_MODEL = {
  modelKey: KIE_ELEVENLABS_V3_MODEL_KEY,
  displayName: "ElevenLabs V3",
  label: "ElevenLabs V3",
  subtitle: "KIE · 多语言对白 · 情感表达",
  role: "TTS" as const,
  paramsSchema: [
    {
      key: "stability",
      label: "稳定性",
      type: "slider" as const,
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: 0.5,
    },
  ],
  defaultParams: { stability: 0.5 },
};

export const KIE_ELEVENLABS_TTS_GATEWAY_MODEL = {
  modelKey: KIE_ELEVENLABS_TTS_MODEL_KEY,
  displayName: "ElevenLabs Text to Speech",
  label: "ElevenLabs Text to Speech",
  subtitle: "KIE · 多语言 TTS · Multilingual v2",
  role: "TTS" as const,
  paramsSchema: [
    {
      key: "voice",
      label: "音色",
      type: "select" as const,
      options: [
        { value: "Rachel", label: "Rachel" },
        { value: "Aria", label: "Aria" },
        { value: "George", label: "George" },
        { value: "Sarah", label: "Sarah" },
      ],
      defaultValue: "Rachel",
    },
    {
      key: "stability",
      label: "稳定性",
      type: "slider" as const,
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: 0.5,
    },
  ],
  defaultParams: { voice: "Rachel", stability: 0.5 },
};

export const KIE_AUDIO_GATEWAY_MODELS = [
  KIE_SUNO_GATEWAY_MODEL,
  KIE_ELEVENLABS_V3_GATEWAY_MODEL,
  KIE_ELEVENLABS_TTS_GATEWAY_MODEL,
] as const;
