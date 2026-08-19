/**
 * DeepSeek · 系统 Provider 已知模型（OpenAI 兼容 chat/completions）。
 * V4：deepseek-v4-flash / deepseek-v4-pro（官方推荐）；legacy deepseek-chat 将退役。
 * 见 https://api-docs.deepseek.com/guides/thinking_mode
 *
 * Chat Completions 支持 thinking / reasoning_effort；**不支持**联网搜索（须 Responses API）。
 */

import type { CanvasGatewayListedModel } from "./types";

export const DEEPSEEK_SYSTEM_BASE_URL = "https://api.deepseek.com/v1";

const DEEPSEEK_V4_LLM_PARAMS = [
  {
    key: "thinking_mode",
    label: "深度思考",
    type: "select" as const,
    options: [
      { value: "disabled", label: "关闭 · 快答（默认）" },
      { value: "enabled", label: "开启 · 链式推理" },
    ],
    defaultValue: "disabled",
    help: "对应 API thinking.type。开启后 temperature 等采样参数通常无效。DeepSeek Chat 不支持联网搜索。",
  },
  {
    key: "reasoning_effort",
    label: "推理深度",
    type: "select" as const,
    options: [
      { value: "low", label: "low（快）" },
      { value: "high", label: "high（深）" },
      { value: "max", label: "max（最深）" },
    ],
    defaultValue: "low",
    help: "仅深度思考开启时生效；剧本长文推荐 low。",
  },
  {
    key: "temperature",
    label: "temperature",
    type: "number" as const,
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 0.7,
    help: "深度思考关闭时生效。",
  },
  {
    key: "max_tokens",
    label: "max_tokens",
    type: "number" as const,
    min: 256,
    max: 64000,
    step: 128,
    defaultValue: 24000,
    help: "输出 token 上限；完整制作包推荐 24000。",
  },
];

const DEEPSEEK_V4_LLM_DEFAULTS = {
  thinking_mode: "disabled",
  reasoning_effort: "low",
  temperature: 0.7,
  max_tokens: 24000,
};

export const DEEPSEEK_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash",
    role: "LLM",
    description: "漫剧文案推荐 · 快速经济 · 1M 上下文 · 可选深度思考",
    paramsSchema: DEEPSEEK_V4_LLM_PARAMS,
    defaultParams: DEEPSEEK_V4_LLM_DEFAULTS,
  },
  {
    modelKey: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    role: "LLM",
    description: "更强推理与长程任务 · 1M 上下文 · 可选深度思考",
    paramsSchema: DEEPSEEK_V4_LLM_PARAMS,
    defaultParams: DEEPSEEK_V4_LLM_DEFAULTS,
  },
  {
    modelKey: "deepseek-chat",
    displayName: "DeepSeek Chat（旧 ID → V4 Flash）",
    role: "LLM",
    description: "兼容别名，建议改用 deepseek-v4-flash",
    paramsSchema: DEEPSEEK_V4_LLM_PARAMS,
    defaultParams: DEEPSEEK_V4_LLM_DEFAULTS,
  },
  {
    modelKey: "deepseek-reasoner",
    displayName: "DeepSeek Reasoner（旧 ID → V4 思考）",
    role: "LLM",
    description: "兼容别名，建议改用 deepseek-v4-flash + 深度思考",
    paramsSchema: DEEPSEEK_V4_LLM_PARAMS,
    defaultParams: {
      ...DEEPSEEK_V4_LLM_DEFAULTS,
      thinking_mode: "enabled",
      reasoning_effort: "high",
    },
  },
];

/** Story / 漫剧默认 DeepSeek 模型（V4） */
export const DEEPSEEK_STORY_DEFAULT_MODEL_KEY = "deepseek-v4-flash";
