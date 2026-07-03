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
    m === "minimax_speech_02"
  );
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
