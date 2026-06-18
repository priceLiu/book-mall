/**
 * 火山方舟（豆包）· OpenAI 兼容 Chat 与视频模型目录。
 * 上游 model 字段见 resolveVolcengineModelKey。
 */

import type { CanvasGatewayListedModel } from "@/lib/canvas/providers/types";
import type { CanvasParamSchema } from "@/lib/canvas/providers/types";

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
  "doubao-seedance-2.0": "doubao-seedance-2-0-260128",
  "Doubao-Seedance-2.0": "doubao-seedance-2-0-260128",
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

const VIDEO_PARAM_SCHEMA = [
  {
    key: "resolution",
    label: "分辨率",
    type: "select" as const,
    options: [
      { value: "720p", label: "720p" },
      { value: "1080p", label: "1080p" },
    ],
    defaultValue: "1080p",
  },
  {
    key: "duration",
    label: "时长（秒）",
    type: "number" as const,
    min: 4,
    max: 15,
    step: 1,
    defaultValue: 15,
  },
  {
    key: "generate_audio",
    label: "生成音频",
    type: "boolean" as const,
    defaultValue: true,
  },
  {
    key: "watermark",
    label: "水印",
    type: "boolean" as const,
    defaultValue: false,
  },
] satisfies CanvasParamSchema;

export const VOLCENGINE_VIDEO_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "doubao-seedance-2.0",
    displayName: "Seedance 2.0 · 真人",
    role: "VIDEO",
    description:
      "火山方舟 · 图/文/音视频参考 · 真人人像须录入人像库并通过审核（asset://）",
    paramsSchema: [...VIDEO_PARAM_SCHEMA],
    defaultParams: {
      resolution: "720p",
      duration: 15,
      generate_audio: true,
      watermark: false,
    },
  },
  {
    modelKey: "doubao-seedance-1.5-pro",
    displayName: "Seedance 1.5 Pro · 真人",
    role: "VIDEO",
    description:
      "火山方舟 · 首尾帧/有声 · 真人人像库 asset://（须审核通过）",
    paramsSchema: [...VIDEO_PARAM_SCHEMA],
    defaultParams: {
      resolution: "1080p",
      duration: 15,
      generate_audio: true,
      watermark: false,
    },
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
