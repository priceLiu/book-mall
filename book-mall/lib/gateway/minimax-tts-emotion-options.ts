import { resolveMinimaxUpstreamSpeechModel } from "@/lib/gateway/minimax-speech-models";

/** MiniMax T2A `voice_setting.emotion` · 与 platform.minimaxi.com API 对齐 */
export type MinimaxTtsEmotionOption = {
  value: string;
  label: string;
  /** `whisper` 仅 speech-2.6-hd / speech-2.6-turbo */
  whisperOnly?: boolean;
};

export const MINIMAX_TTS_EMOTION_OPTIONS: MinimaxTtsEmotionOption[] = [
  { value: "", label: "默认" },
  { value: "happy", label: "开心" },
  { value: "sad", label: "悲伤" },
  { value: "angry", label: "愤怒" },
  { value: "fearful", label: "恐惧" },
  { value: "disgusted", label: "厌恶" },
  { value: "surprised", label: "惊讶" },
  { value: "calm", label: "平静" },
  { value: "neutral", label: "中性" },
  { value: "fluent", label: "旁白/流畅" },
  { value: "whisper", label: "低语", whisperOnly: true },
];

export const MINIMAX_TTS_EMOTION_VALUES = new Set(
  MINIMAX_TTS_EMOTION_OPTIONS.map((o) => o.value).filter(Boolean),
);

export function isMinimaxWhisperEmotionSupported(upstreamModel: string): boolean {
  const m = upstreamModel.trim();
  return m === "speech-2.6-hd" || m === "speech-2.6-turbo";
}

export function minimaxTtsEmotionOptionsForModelKey(
  modelKey: string,
): MinimaxTtsEmotionOption[] {
  const upstream = resolveMinimaxUpstreamSpeechModel(modelKey);
  return MINIMAX_TTS_EMOTION_OPTIONS.filter(
    (o) => !o.whisperOnly || isMinimaxWhisperEmotionSupported(upstream),
  );
}

/** 校验 emotion 是否可用于当前模型；非法值返回 undefined（不传 API） */
export function resolveMinimaxTtsEmotionForModel(args: {
  modelKey: string;
  emotionRaw: unknown;
}): string | undefined {
  const emotion = String(args.emotionRaw ?? "").trim();
  if (!emotion) return undefined;
  if (!MINIMAX_TTS_EMOTION_VALUES.has(emotion)) return undefined;
  const upstream = resolveMinimaxUpstreamSpeechModel(args.modelKey);
  if (emotion === "whisper" && !isMinimaxWhisperEmotionSupported(upstream)) {
    return undefined;
  }
  return emotion;
}

export function minimaxTtsEmotionLabel(value: string): string {
  const hit = MINIMAX_TTS_EMOTION_OPTIONS.find((o) => o.value === value);
  return hit?.label ?? value;
}
