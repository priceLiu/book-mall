/**
 * 百炼 OpenAI 兼容 Chat 模型（经 Gateway BAILIAN 凭证路由）。
 * 模型 ID 与 DashScope compatible-mode /v1/chat/completions 一致。
 */

import type { CanvasGatewayListedModel } from "@/lib/canvas/providers/types";

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
    max: 32000,
    step: 128,
    defaultValue: 8000,
  },
] as const;

export const BAILIAN_CHAT_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "qwen3.7-plus",
    displayName: "Qwen3.7-Plus",
    role: "LLM",
    description: "百炼 · 旗舰 · 视频/图片理解 · 反推提示词",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 8000 },
  },
  {
    modelKey: "qwen3.5-plus",
    displayName: "Qwen3.5-Plus",
    role: "LLM",
    description: "百炼 · 效果优先 · 视频/图片理解",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 8000 },
  },
  {
    modelKey: "qwen3-vl-plus",
    displayName: "Qwen3-VL-Plus",
    role: "LLM",
    description: "百炼 · 多模态 · 视频理解 · 反推提示词推荐",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 8000 },
  },
  {
    modelKey: "qwen3.5-27b",
    displayName: "Qwen3.5-27B",
    role: "LLM",
    description: "百炼 · 均衡性价比 · 提示词优化推荐",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 8000 },
  },
  {
    modelKey: "qwen3.5-flash",
    displayName: "Qwen3.5-Flash",
    role: "LLM",
    description: "百炼 · 快速经济",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 8000 },
  },
  {
    modelKey: "qwen-plus",
    displayName: "Qwen Plus",
    role: "LLM",
    description: "百炼 · 经典均衡模型",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 2000 },
  },
  {
    modelKey: "qwen-max",
    displayName: "Qwen Max",
    role: "LLM",
    description: "百炼 · 效果优先（耗时更长）",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 8000 },
  },
  {
    modelKey: "MiniMax/MiniMax-M2.7",
    displayName: "MiniMax M2.7",
    role: "LLM",
    description: "百炼 · MiniMax 旗舰 · 编程/摘要 · 提示词优化推荐",
    paramsSchema: [
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number" as const,
        min: 256,
        max: 32000,
        step: 128,
        defaultValue: 8000,
      },
    ],
    defaultParams: { max_tokens: 8000 },
  },
  {
    modelKey: "MiniMax/MiniMax-M2.5",
    displayName: "MiniMax M2.5",
    role: "LLM",
    description: "百炼 · MiniMax M2.5（兼容保留）",
    paramsSchema: [
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number" as const,
        min: 256,
        max: 32000,
        step: 128,
        defaultValue: 8000,
      },
    ],
    defaultParams: { max_tokens: 8000 },
  },
  {
    modelKey: "MiniMax-M2.5",
    displayName: "MiniMax M2.5 Legacy Alias",
    role: "LLM",
    description: "百炼 · 历史 modelKey 别名，等同 MiniMax/MiniMax-M2.5",
    paramsSchema: [
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number" as const,
        min: 256,
        max: 32000,
        step: 128,
        defaultValue: 8000,
      },
    ],
    defaultParams: { max_tokens: 8000 },
  },
];
