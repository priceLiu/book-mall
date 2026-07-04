/** MiniMax 语音 / 音乐 Gateway 模型登记（QuickReplica + Gateway 路由） */

export const MINIMAX_SPEECH_MODELS = [
  {
    modelKey: "MiniMax/speech-2.8-hd",
    upstreamModel: "speech-2.8-hd",
    label: "MiniMax Speech 2.8 HD",
    subtitle: "高质量旁白 · 多语言",
  },
  {
    modelKey: "MiniMax/speech-2.8-turbo",
    upstreamModel: "speech-2.8-turbo",
    label: "MiniMax Speech 2.8 Turbo",
    subtitle: "低延迟旁白",
  },
  {
    modelKey: "MiniMax/speech-2.6-hd",
    upstreamModel: "speech-2.6-hd",
    label: "MiniMax Speech 2.6 HD",
    subtitle: "高清语音 · 情感控制",
  },
  {
    modelKey: "MiniMax/speech-2.6-turbo",
    upstreamModel: "speech-2.6-turbo",
    label: "MiniMax Speech 2.6 Turbo",
    subtitle: "快速语音 · 情感控制",
  },
  {
    modelKey: "MiniMax/speech-02-hd",
    upstreamModel: "speech-02-hd",
    label: "MiniMax Speech 02 HD",
    subtitle: "高清语音合成",
  },
  {
    modelKey: "MiniMax/speech-02-turbo",
    upstreamModel: "speech-02-turbo",
    label: "MiniMax Speech 02 Turbo",
    subtitle: "快速语音合成",
  },
] as const;

/** 音色快速复刻 · 试听合成可选模型 */
export const MINIMAX_VOICE_CLONE_SPEECH_MODELS = MINIMAX_SPEECH_MODELS.filter((m) =>
  ["speech-2.8-hd", "speech-2.8-turbo", "speech-2.6-hd", "speech-2.6-turbo"].includes(
    m.upstreamModel,
  ),
);

export const MINIMAX_LANGUAGE_BOOST_OPTIONS = [
  "auto",
  "Chinese",
  "Chinese,Yue",
  "English",
  "Arabic",
  "Russian",
  "Spanish",
  "French",
  "Portuguese",
  "German",
  "Turkish",
  "Dutch",
  "Ukrainian",
  "Vietnamese",
  "Indonesian",
  "Japanese",
  "Italian",
  "Korean",
  "Thai",
  "Polish",
  "Romanian",
  "Greek",
  "Czech",
  "Finnish",
  "Hindi",
  "Bulgarian",
  "Danish",
  "Hebrew",
  "Malay",
  "Persian",
  "Slovak",
  "Swedish",
  "Croatian",
  "Filipino",
  "Hungarian",
  "Norwegian",
  "Slovenian",
  "Catalan",
  "Nynorsk",
  "Tamil",
  "Afrikaans",
] as const;

export type MinimaxLanguageBoost = (typeof MINIMAX_LANGUAGE_BOOST_OPTIONS)[number];

export const MINIMAX_MUSIC_MODELS = [
  {
    modelKey: "MiniMax/music-1.5",
    upstreamModel: "music-1.5",
    label: "MiniMax Music 1.5",
    subtitle: "音乐生成",
  },
] as const;

export const MINIMAX_DEFAULT_SPEECH_MODEL_KEY = "MiniMax/speech-2.8-hd";
export const MINIMAX_DEFAULT_MUSIC_MODEL_KEY = "MiniMax/music-1.5";

export function isMinimaxSpeechModelKey(modelKey: string): boolean {
  const m = modelKey.trim().toLowerCase();
  return (
    m.startsWith("minimax/speech-") ||
    m.startsWith("speech-2") ||
    m.startsWith("speech-02") ||
    m.startsWith("speech-01") ||
    m === "minimax_speech_02"
  );
}

export function isMinimaxVoiceCloneSpeechModelKey(modelKey: string): boolean {
  const upstream = resolveMinimaxUpstreamSpeechModel(modelKey);
  return MINIMAX_VOICE_CLONE_SPEECH_MODELS.some((m) => m.upstreamModel === upstream);
}

export function isMinimaxMusicModelKey(modelKey: string): boolean {
  const m = modelKey.trim().toLowerCase();
  return m.startsWith("minimax/music-") || m.startsWith("music-");
}

export function resolveMinimaxUpstreamSpeechModel(modelKey: string): string {
  const key = modelKey.trim();
  const hit = MINIMAX_SPEECH_MODELS.find((m) => m.modelKey === key);
  if (hit) return hit.upstreamModel;
  if (key.startsWith("MiniMax/")) return key.slice("MiniMax/".length);
  if (key === "minimax_speech_02") return "speech-02-hd";
  return key;
}

export function resolveMinimaxUpstreamMusicModel(modelKey: string): string {
  const key = modelKey.trim();
  const hit = MINIMAX_MUSIC_MODELS.find((m) => m.modelKey === key);
  if (hit) return hit.upstreamModel;
  if (key.startsWith("MiniMax/")) return key.slice("MiniMax/".length);
  return key;
}
