/**
 * Moonshot / Kimi · 系统 Provider 已知模型（OpenAI 兼容 chat/completions）。
 * 见 https://platform.kimi.com/docs/api/overview
 */

import type { CanvasGatewayListedModel } from "./types";

export const MOONSHOT_SYSTEM_BASE_URL = "https://api.moonshot.cn/v1";

const MAX_TOKENS_SCHEMA = [
  {
    key: "max_tokens",
    label: "max_tokens",
    type: "number" as const,
    min: 256,
    max: 131072,
    step: 256,
    defaultValue: 16384,
  },
];

const K26_THINKING_SCHEMA = [
  ...MAX_TOKENS_SCHEMA,
  {
    key: "thinking_mode",
    label: "深度思考",
    type: "select" as const,
    options: [
      { value: "enabled", label: "开启（默认）" },
      { value: "disabled", label: "关闭 · 更快" },
    ],
    defaultValue: "enabled",
    help: "Kimi K2.6 专有；temperature 由模型固定，勿手动传入。",
  },
];

export const MOONSHOT_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "kimi-k3",
    displayName: "Kimi K3",
    role: "LLM",
    description: "旗舰 · 1M 上下文 · 剧本 / 长文推荐",
    paramsSchema: MAX_TOKENS_SCHEMA,
    defaultParams: {
      max_tokens: 16384,
    },
  },
  {
    modelKey: "kimi-k2.6",
    displayName: "Kimi K2.6",
    role: "LLM",
    description: "256K 上下文 · 可选深度思考 · 剧本创作",
    paramsSchema: K26_THINKING_SCHEMA,
    defaultParams: {
      max_tokens: 16384,
      thinking_mode: "enabled",
    },
  },
  {
    modelKey: "kimi-k2.7-code",
    displayName: "Kimi K2.7 Code",
    role: "LLM",
    description: "256K · 代码 / 结构化剧本 · 始终深度思考",
    paramsSchema: MAX_TOKENS_SCHEMA,
    defaultParams: {
      max_tokens: 16384,
    },
  },
];

/** Story / 漫剧默认 Kimi 模型 */
export const MOONSHOT_STORY_DEFAULT_MODEL_KEY = "kimi-k3";
