/**
 * 火山方舟（豆包）· OpenAI 兼容 Chat 与视频模型目录。
 * 上游 model 字段见 resolveVolcengineModelKey。
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

/** 控制台展示名 / 别名 → 方舟 API model */
export const VOLCENGINE_MODEL_UPSTREAM: Record<string, string> = {
  "doubao-seed-2.0-lite": "doubao-seed-2-0-lite-260215",
  "Doubao-Seed-2.0-lite": "doubao-seed-2-0-lite-260215",
  "doubao-seed-2.0-mini": "doubao-seed-2-0-mini-260215",
  "Doubao-Seed-2.0-mini": "doubao-seed-2-0-mini-260215",
  /** 须在方舟控制台开通对应模型；未开通时返回 ModelNotOpen */
  "doubao-lite-32k": "doubao-1-5-lite-32k-250115",
  "Doubao-lite-32k": "doubao-1-5-lite-32k-250115",
  "doubao-seedance-1.5-pro": "doubao-seedance-1-5-pro-251215",
  "Doubao-Seedance-1.5-pro": "doubao-seedance-1-5-pro-251215",
};

export const VOLCENGINE_CHAT_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "doubao-seed-2.0-lite",
    displayName: "Doubao-Seed-2.0-lite",
    role: "LLM",
    description: "火山方舟 · 均衡性价比 · 256k 上下文",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 8000 },
  },
  {
    modelKey: "doubao-seed-2.0-mini",
    displayName: "Doubao-Seed-2.0-mini",
    role: "LLM",
    description: "火山方舟 · 轻量快速",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 8000 },
  },
  {
    modelKey: "doubao-lite-32k",
    displayName: "Doubao-lite-32k",
    role: "LLM",
    description: "火山方舟 · 32k 轻量（上游 doubao-1-5-lite-32k-250115，须在控制台开通）",
    paramsSchema: [...LLM_TEMP_SCHEMA],
    defaultParams: { temperature: 0.7, max_tokens: 4000 },
  },
];

export const VOLCENGINE_VIDEO_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "doubao-seedance-1.5-pro",
    displayName: "Doubao-Seedance-1.5-pro",
    role: "VIDEO",
    description: "火山方舟 · 文/图生视频 · 有声 · 异步任务",
    paramsSchema: [],
    defaultParams: {},
  },
];

export const VOLCENGINE_ALL_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  ...VOLCENGINE_CHAT_KNOWN_MODELS,
  ...VOLCENGINE_VIDEO_KNOWN_MODELS,
];

export function resolveVolcengineModelKey(modelKey: string): string {
  const raw = modelKey.trim();
  const lower = raw.toLowerCase();
  return (
    VOLCENGINE_MODEL_UPSTREAM[raw] ??
    VOLCENGINE_MODEL_UPSTREAM[lower] ??
    raw
  );
}

export const VOLCENGINE_CHAT_MODEL_KEYS = new Set(
  VOLCENGINE_CHAT_KNOWN_MODELS.map((m) => m.modelKey.toLowerCase()),
);

export const VOLCENGINE_VIDEO_MODEL_KEYS = new Set(
  VOLCENGINE_VIDEO_KNOWN_MODELS.map((m) => m.modelKey.toLowerCase()),
);
