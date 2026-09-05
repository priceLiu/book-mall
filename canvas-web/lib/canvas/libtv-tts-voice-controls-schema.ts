import type { CanvasParamSchema } from "@/lib/canvas-providers-api";

/** 与 book-mall ai-space-tts-voice-controls 对齐 · MiniMax T2A */
export const LIBTV_MINIMAX_TTS_EMOTION_OPTIONS = [
  { value: "", label: "默认" },
  { value: "happy", label: "开心" },
  { value: "sad", label: "悲伤" },
  { value: "angry", label: "愤怒" },
  { value: "fearful", label: "恐惧" },
  { value: "disgusted", label: "厌恶" },
  { value: "surprised", label: "惊讶" },
  { value: "calm", label: "平静" },
  { value: "neutral", label: "中性" },
] as const;

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

export const LIBTV_MINIMAX_TTS_VOICE_PARAMS_SCHEMA = [
  {
    key: "emotion",
    label: "情绪",
    type: "select" as const,
    options: [...LIBTV_MINIMAX_TTS_EMOTION_OPTIONS],
    defaultValue: "",
  },
  ...LIBTV_TTS_SPEED_VOLUME_PITCH_SCHEMA,
] satisfies CanvasParamSchema;

export const LIBTV_QWEN_TTS_INSTRUCTION_SCHEMA = {
  key: "instruction",
  label: "语气指令",
  type: "textarea" as const,
  placeholder: "如：语速稍快，语气亲切",
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
