/**
 * DeepSeek · 系统 Provider 已知模型（OpenAI 兼容 chat/completions）。
 * 见 canvas-web/docs/story-eng.md
 */

import type { CanvasGatewayListedModel } from "./types";

export const DEEPSEEK_SYSTEM_BASE_URL = "https://api.deepseek.com/v1";

export const DEEPSEEK_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "deepseek-chat",
    displayName: "DeepSeek Chat (V3.2)",
    role: "LLM",
    description: "漫剧文案推荐 · 故事大纲 / 角色 / 分镜",
    paramsSchema: [
      {
        key: "temperature",
        label: "temperature",
        type: "number",
        min: 0,
        max: 2,
        step: 0.1,
        defaultValue: 0.7,
      },
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number",
        min: 256,
        max: 16000,
        step: 128,
        defaultValue: 4000,
      },
    ],
    defaultParams: {
      temperature: 0.7,
      max_tokens: 4000,
    },
  },
  {
    modelKey: "deepseek-reasoner",
    displayName: "DeepSeek Reasoner (V3.2 思考)",
    role: "LLM",
    description: "深度推理模式，响应较慢",
    paramsSchema: [
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number",
        min: 256,
        max: 16000,
        step: 128,
        defaultValue: 8000,
      },
    ],
    defaultParams: {
      max_tokens: 8000,
    },
  },
];
