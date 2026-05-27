/**
 * DeepSeek · 系统 Provider 已知模型（OpenAI 兼容 chat/completions）。
 * V4：deepseek-v4-flash / deepseek-v4-pro（官方推荐）；legacy deepseek-chat 将退役。
 * 见 https://api-docs.deepseek.com/
 */

import type { CanvasGatewayListedModel } from "./types";

export const DEEPSEEK_SYSTEM_BASE_URL = "https://api.deepseek.com/v1";

const LLM_TEMP_SCHEMA = [
  {
    key: "temperature",
    label: "temperature",
    type: "number" as const,
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 0.7,
  },
  {
    key: "max_tokens",
    label: "max_tokens",
    type: "number" as const,
    min: 256,
    max: 16000,
    step: 128,
    defaultValue: 16000,
  },
];

export const DEEPSEEK_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash",
    role: "LLM",
    description: "漫剧文案推荐 · 快速经济 · 1M 上下文",
    paramsSchema: LLM_TEMP_SCHEMA,
    defaultParams: {
      temperature: 0.7,
      max_tokens: 16000,
    },
  },
  {
    modelKey: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    role: "LLM",
    description: "更强推理与长程任务 · 1M 上下文",
    paramsSchema: LLM_TEMP_SCHEMA,
    defaultParams: {
      temperature: 0.7,
      max_tokens: 16000,
    },
  },
  {
    modelKey: "deepseek-chat",
    displayName: "DeepSeek Chat（旧 ID → V4 Flash）",
    role: "LLM",
    description: "兼容别名，建议改用 deepseek-v4-flash",
    paramsSchema: LLM_TEMP_SCHEMA,
    defaultParams: {
      temperature: 0.7,
      max_tokens: 16000,
    },
  },
  {
    modelKey: "deepseek-reasoner",
    displayName: "DeepSeek Reasoner（旧 ID → V4 思考）",
    role: "LLM",
    description: "兼容别名，建议改用 deepseek-v4-flash + thinking",
    paramsSchema: [
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number",
        min: 256,
        max: 16000,
        step: 128,
        defaultValue: 16000,
      },
    ],
    defaultParams: {
      max_tokens: 16000,
    },
  },
];

/** Story / 漫剧默认 DeepSeek 模型（V4） */
export const DEEPSEEK_STORY_DEFAULT_MODEL_KEY = "deepseek-v4-flash";
