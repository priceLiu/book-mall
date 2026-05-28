/**
 * 漫剧 / 影视专业版 · TTS 配音（Gateway · 百炼 Qwen3-TTS / OpenAI 兼容 tts-1）
 */
import type { CanvasParamSchema } from "./types";

const QWEN_TTS_VOICE_SCHEMA = [
  {
    key: "voice",
    label: "音色",
    type: "select",
    options: [
      { value: "Cherry", label: "Cherry（女声）" },
      { value: "Serena", label: "Serena（女声）" },
      { value: "Ryan", label: "Ryan（男声）" },
      { value: "Aiden", label: "Aiden（男声）" },
      { value: "Dylan", label: "Dylan" },
      { value: "Vivian", label: "Vivian" },
    ],
    defaultValue: "Cherry",
  },
  {
    key: "language_type",
    label: "语种",
    type: "select",
    options: [
      { value: "Chinese", label: "中文" },
      { value: "English", label: "English" },
    ],
    defaultValue: "Chinese",
  },
] satisfies CanvasParamSchema;

const OPENAI_TTS_VOICE_SCHEMA = [
  {
    key: "voice",
    label: "音色",
    type: "select",
    options: [
      { value: "alloy", label: "alloy" },
      { value: "echo", label: "echo" },
      { value: "fable", label: "fable" },
      { value: "onyx", label: "onyx" },
      { value: "nova", label: "nova" },
      { value: "shimmer", label: "shimmer" },
    ],
    defaultValue: "alloy",
  },
] satisfies CanvasParamSchema;

export const STORY_TTS_GATEWAY_MODELS = [
  {
    modelKey: "qwen3-tts",
    displayName: "Qwen3 TTS (Gateway)",
    role: "LLM" as const,
    description: "百炼 · 对白合成，剪映导出 audio 轨。",
    paramsSchema: QWEN_TTS_VOICE_SCHEMA,
    defaultParams: { voice: "Cherry", language_type: "Chinese" },
  },
  {
    modelKey: "tts-1-hd",
    displayName: "TTS 1 HD (Gateway)",
    role: "LLM" as const,
    description: "OpenAI 兼容高清语音（需凭证 base 支持 /audio/speech）。",
    paramsSchema: OPENAI_TTS_VOICE_SCHEMA,
    defaultParams: { voice: "alloy" },
  },
  {
    modelKey: "tts-1",
    displayName: "TTS 1 (Gateway)",
    role: "LLM" as const,
    description: "OpenAI 兼容标准语音（需凭证 base 支持 /audio/speech）。",
    paramsSchema: OPENAI_TTS_VOICE_SCHEMA,
    defaultParams: { voice: "alloy" },
  },
];
