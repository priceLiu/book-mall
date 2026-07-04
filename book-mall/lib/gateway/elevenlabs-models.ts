/** ElevenLabs Gateway 模型登记（QuickReplica 变声器 / 音效 / 音乐） */

export const ELEVENLABS_DEFAULT_API_ROOT = "https://api.elevenlabs.io";

export const ELEVENLABS_STS_MODELS = [
  {
    modelKey: "Eleven/english-sts-v2",
    upstreamModel: "eleven_english_sts_v2",
    label: "Eleven English STS v2",
    subtitle: "Real-time speech-to-speech voice conversion",
    popular: true,
  },
  {
    modelKey: "Eleven/multilingual-sts-v2",
    upstreamModel: "eleven_multilingual_sts_v2",
    label: "Eleven Multilingual v2",
    subtitle: "High-quality multilingual speech-to-speech voice conversion",
  },
] as const;

export const ELEVENLABS_SFX_MODELS = [
  {
    modelKey: "Eleven/sound-effects-v2",
    upstreamModel: "eleven_text_to_sound_v2",
    label: "Eleven Sound Effects v2",
    subtitle: "Text-to-sound effects · loop & duration control",
  },
] as const;

export const ELEVENLABS_MUSIC_MODELS = [
  {
    modelKey: "Eleven/music-v2",
    upstreamModel: "music_v2",
    label: "Eleven Music v2",
    subtitle: "Text-to-music · quick clip & full song",
  },
] as const;

export const ELEVENLABS_DEFAULT_STS_MODEL_KEY = "Eleven/multilingual-sts-v2" as const;
export const ELEVENLABS_DEFAULT_SFX_MODEL_KEY = "Eleven/sound-effects-v2" as const;
export const ELEVENLABS_DEFAULT_MUSIC_MODEL_KEY = "Eleven/music-v2" as const;

/** 音效 API 默认 upstream（UI 不暴露模型选择） */
export const ELEVENLABS_SFX_UPSTREAM_MODEL = "eleven_text_to_sound_v2" as const;
/** 音乐 API 默认 upstream（UI 不暴露模型选择） */
export const ELEVENLABS_MUSIC_UPSTREAM_MODEL = "music_v2" as const;

/** ElevenLabs 默认目标音色（George） */
export const ELEVENLABS_DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

const STS_KEYS = new Set(ELEVENLABS_STS_MODELS.map((m) => m.modelKey.toLowerCase()));
const SFX_KEYS = new Set(ELEVENLABS_SFX_MODELS.map((m) => m.modelKey.toLowerCase()));
const MUSIC_KEYS = new Set(ELEVENLABS_MUSIC_MODELS.map((m) => m.modelKey.toLowerCase()));
const ALL_KEYS = new Set([...STS_KEYS, ...SFX_KEYS, ...MUSIC_KEYS]);

export function isElevenLabsModelKey(modelKey: string): boolean {
  return ALL_KEYS.has(modelKey.trim().toLowerCase());
}

export function isElevenLabsStsModelKey(modelKey: string): boolean {
  return STS_KEYS.has(modelKey.trim().toLowerCase());
}

export function isElevenLabsSfxModelKey(modelKey: string): boolean {
  return SFX_KEYS.has(modelKey.trim().toLowerCase());
}

export function isElevenLabsMusicModelKey(modelKey: string): boolean {
  return MUSIC_KEYS.has(modelKey.trim().toLowerCase());
}

export function resolveElevenLabsUpstreamModel(modelKey: string): string {
  const key = modelKey.trim();
  const hit =
    ELEVENLABS_STS_MODELS.find((m) => m.modelKey === key) ??
    ELEVENLABS_SFX_MODELS.find((m) => m.modelKey === key) ??
    ELEVENLABS_MUSIC_MODELS.find((m) => m.modelKey === key);
  if (!hit) throw new Error(`未知 ElevenLabs 模型: ${modelKey}`);
  return hit.upstreamModel;
}

export function resolveElevenLabsApiRoot(baseUrl?: string | null): string {
  const raw = (baseUrl?.trim() || ELEVENLABS_DEFAULT_API_ROOT).replace(/\/$/, "");
  return raw || ELEVENLABS_DEFAULT_API_ROOT;
}
