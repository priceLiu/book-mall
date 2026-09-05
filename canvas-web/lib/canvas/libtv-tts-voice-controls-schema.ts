import type { CanvasParamSchema } from "@/lib/canvas-providers-api";

/** 与 book-mall `minimax-tts-emotion-options.ts` 对齐 · MiniMax T2A */
export type LibtvMinimaxTtsEmotionOption = {
  value: string;
  label: string;
  whisperOnly?: boolean;
};

export const LIBTV_MINIMAX_TTS_EMOTION_OPTIONS: LibtvMinimaxTtsEmotionOption[] = [
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

function resolveMinimaxUpstreamSpeechModel(modelKey: string): string {
  const k = modelKey.trim();
  if (k.includes("/")) {
    const tail = k.split("/").pop()?.trim();
    if (tail) return tail;
  }
  return k;
}

function isMinimaxWhisperEmotionSupported(upstreamModel: string): boolean {
  const m = upstreamModel.trim();
  return m === "speech-2.6-hd" || m === "speech-2.6-turbo";
}

export function resolveLibtvMinimaxTtsEmotionOptions(
  modelKey: string,
): LibtvMinimaxTtsEmotionOption[] {
  const upstream = resolveMinimaxUpstreamSpeechModel(modelKey);
  return LIBTV_MINIMAX_TTS_EMOTION_OPTIONS.filter(
    (o) => !o.whisperOnly || isMinimaxWhisperEmotionSupported(upstream),
  );
}

export function libtvMinimaxTtsEmotionLabel(value: string): string {
  const hit = LIBTV_MINIMAX_TTS_EMOTION_OPTIONS.find((o) => o.value === value);
  return hit?.label ?? value;
}

export const LIBTV_TTS_SPEED_VOLUME_PITCH_SCHEMA = [
  {
    key: "speed",
    label: "语速",
    type: "number" as const,
    min: 0.5,
    max: 2,
    step: 0.01,
    defaultValue: 1,
  },
  {
    key: "vol",
    label: "音量",
    type: "number" as const,
    min: 0,
    max: 2,
    step: 0.01,
    defaultValue: 1,
  },
  {
    key: "pitch",
    label: "音调",
    type: "number" as const,
    min: -12,
    max: 12,
    step: 1,
    defaultValue: 0,
  },
] satisfies CanvasParamSchema;

export function buildLibtvMinimaxTtsVoiceParamsSchema(
  modelKey: string,
): CanvasParamSchema {
  return [
    {
      key: "emotion",
      label: "情绪",
      type: "select" as const,
      options: resolveLibtvMinimaxTtsEmotionOptions(modelKey).map((o) => ({
        value: o.value,
        label: o.label,
      })),
      defaultValue: "",
    },
    ...LIBTV_TTS_SPEED_VOLUME_PITCH_SCHEMA,
  ];
}

/** @deprecated 使用 buildLibtvMinimaxTtsVoiceParamsSchema(modelKey) */
export const LIBTV_MINIMAX_TTS_VOICE_PARAMS_SCHEMA = buildLibtvMinimaxTtsVoiceParamsSchema(
  "MiniMax/speech-2.8-hd",
);

export const LIBTV_QWEN_TTS_INSTRUCTION_SCHEMA = {
  key: "instruction",
  label: "语气指令",
  type: "textarea" as const,
  placeholder: "如：商业预告片旁白，低沉有力，节奏沉稳",
  defaultValue: "",
};

export const LIBTV_TTS_VOICE_CONTROL_DEFAULTS = {
  emotion: "",
  speed: 1,
  vol: 1,
  pitch: 0,
  language_type: "Chinese",
  instruction: "",
};
