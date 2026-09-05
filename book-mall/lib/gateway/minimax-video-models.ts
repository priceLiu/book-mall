/**
 * MiniMax H3 视频生成 · Gateway 模型登记
 * @see https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create
 */

import type { CanvasParamSchema } from "@/lib/canvas/providers/types";

export const MINIMAX_H3_UPSTREAM_MODEL = "MiniMax-H3";

export type MinimaxVideoTaskKind =
  | "generation"
  | "regeneration"
  | "h3_context_ir";

export type MinimaxVideoMode =
  | "t2v"
  | "i2v"
  | "fl2v"
  | "r2v"
  | "s2v";

export type MinimaxVideoKnownModel = {
  modelKey: string;
  displayName: string;
  description: string;
  mode: MinimaxVideoMode | "regeneration" | "context_ir";
  taskKind: MinimaxVideoTaskKind;
  capabilities: string[];
  paramsSchema: CanvasParamSchema;
  defaultParams: Record<string, unknown>;
};

const H3_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "21:9", label: "21:9" },
  { value: "adaptive", label: "自适应" },
] as const;

const H3_VIDEO_PARAM_SCHEMA = [
  {
    key: "resolution",
    label: "分辨率",
    type: "select",
    options: [
      { value: "2K", label: "2K" },
      { value: "768P", label: "768P" },
    ],
    defaultValue: "2K",
  },
  {
    key: "duration",
    label: "时长(秒)",
    type: "number",
    min: 4,
    max: 15,
    step: 1,
    defaultValue: 5,
  },
  {
    key: "ratio",
    label: "画幅",
    type: "select",
    options: [...H3_RATIO_OPTIONS],
    defaultValue: "16:9",
  },
  {
    key: "generate_audio",
    label: "生成音轨",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "aigc_watermark",
    label: "AIGC 水印",
    type: "boolean",
    defaultValue: false,
  },
] satisfies CanvasParamSchema;

const H3_REGEN_PARAM_SCHEMA = [
  {
    key: "resolution",
    label: "目标分辨率",
    type: "select",
    options: [{ value: "2K", label: "2K (768P→2K)" }],
    defaultValue: "2K",
  },
  {
    key: "aigc_watermark",
    label: "AIGC 水印",
    type: "boolean",
    defaultValue: false,
  },
] satisfies CanvasParamSchema;

const H3_CONTEXT_IR_PARAM_SCHEMA = [
  {
    key: "duration",
    label: "目标视频时长(秒)",
    type: "number",
    min: 4,
    max: 15,
    step: 1,
    defaultValue: 5,
  },
  {
    key: "ratio",
    label: "画幅",
    type: "select",
    options: [...H3_RATIO_OPTIONS],
    defaultValue: "16:9",
  },
] satisfies CanvasParamSchema;

export const MINIMAX_VIDEO_KNOWN_MODELS: MinimaxVideoKnownModel[] = [
  {
    modelKey: "MiniMax/MiniMax-H3-t2v",
    displayName: "MiniMax H3 · 文生视频",
    description: "文本提示词生成视频；文生须指定具体画幅（不可 adaptive）。",
    mode: "t2v",
    taskKind: "generation",
    capabilities: ["text-to-video"],
    paramsSchema: H3_VIDEO_PARAM_SCHEMA,
    defaultParams: { resolution: "2K", duration: 5, ratio: "16:9", aigc_watermark: false, generate_audio: true },
  },
  {
    modelKey: "MiniMax/MiniMax-H3-i2v",
    displayName: "MiniMax H3 · 图生视频",
    description: "首帧图 + 文本生成视频；画幅由输入图自适应。",
    mode: "i2v",
    taskKind: "generation",
    capabilities: ["image-to-video"],
    paramsSchema: H3_VIDEO_PARAM_SCHEMA.map((p) =>
      p.key === "ratio" ? { ...p, defaultValue: "adaptive" } : p,
    ) as CanvasParamSchema,
    defaultParams: { resolution: "2K", duration: 5, ratio: "adaptive", aigc_watermark: false, generate_audio: true },
  },
  {
    modelKey: "MiniMax/MiniMax-H3-fl2v",
    displayName: "MiniMax H3 · 首尾帧生视频",
    description: "首帧 + 尾帧 + 文本生成过渡视频。",
    mode: "fl2v",
    taskKind: "generation",
    capabilities: ["image-to-video", "first-last-frame"],
    paramsSchema: H3_VIDEO_PARAM_SCHEMA.map((p) =>
      p.key === "ratio" ? { ...p, defaultValue: "adaptive" } : p,
    ) as CanvasParamSchema,
    defaultParams: { resolution: "2K", duration: 5, ratio: "adaptive", aigc_watermark: false, generate_audio: true },
  },
  {
    modelKey: "MiniMax/MiniMax-H3-r2v",
    displayName: "MiniMax H3 · 多模态参考生视频",
    description: "参考图/视频/音频 + 文本生成视频（reference_* 角色）。",
    mode: "r2v",
    taskKind: "generation",
    capabilities: ["reference-to-video", "image-to-video"],
    paramsSchema: H3_VIDEO_PARAM_SCHEMA.map((p) =>
      p.key === "ratio" ? { ...p, defaultValue: "adaptive" } : p,
    ) as CanvasParamSchema,
    defaultParams: { resolution: "2K", duration: 5, ratio: "adaptive", aigc_watermark: false, generate_audio: true },
  },
  {
    modelKey: "MiniMax/MiniMax-H3-s2v",
    displayName: "MiniMax H3 · 主体参考生视频",
    description: "人物主体参考图 + 文本生成视频（reference_image）。",
    mode: "s2v",
    taskKind: "generation",
    capabilities: ["subject-reference", "image-to-video"],
    paramsSchema: H3_VIDEO_PARAM_SCHEMA.map((p) =>
      p.key === "ratio" ? { ...p, defaultValue: "adaptive" } : p,
    ) as CanvasParamSchema,
    defaultParams: { resolution: "2K", duration: 5, ratio: "adaptive", aigc_watermark: false, generate_audio: true },
  },
  {
    modelKey: "MiniMax/MiniMax-H3-regeneration",
    displayName: "MiniMax H3 · 视频再生成 (768P→2K)",
    description: "将符合规格的 768P 成片再生成 2K 视频。",
    mode: "regeneration",
    taskKind: "regeneration",
    capabilities: ["video-upscale", "regeneration"],
    paramsSchema: H3_REGEN_PARAM_SCHEMA,
    defaultParams: { resolution: "2K", aigc_watermark: false },
  },
  {
    modelKey: "MiniMax/MiniMax-H3-context-ir",
    displayName: "MiniMax H3 · Context IR 提示词增强",
    description: "多模态上下文理解，输出结构化增强视频提示词（不生视频）。",
    mode: "context_ir",
    taskKind: "h3_context_ir",
    capabilities: ["prompt-enhance"],
    paramsSchema: H3_CONTEXT_IR_PARAM_SCHEMA,
    defaultParams: { duration: 5, ratio: "16:9" },
  },
];

export const MINIMAX_VIDEO_MODEL_KEYS = new Set(
  MINIMAX_VIDEO_KNOWN_MODELS.map((m) => m.modelKey.toLowerCase()),
);

export function isMinimaxVideoModelKey(modelKey: string | null | undefined): boolean {
  const k = modelKey?.trim().toLowerCase() ?? "";
  if (!k) return false;
  if (MINIMAX_VIDEO_MODEL_KEYS.has(k)) return true;
  return k === "minimax-h3" || k === "minimax/minimax-h3";
}

export function resolveMinimaxVideoModel(modelKey: string): MinimaxVideoKnownModel | null {
  const k = modelKey.trim();
  const hit = MINIMAX_VIDEO_KNOWN_MODELS.find(
    (m) => m.modelKey.toLowerCase() === k.toLowerCase(),
  );
  if (hit) return hit;
  if (k.toLowerCase() === "minimax-h3" || k.toLowerCase() === "minimax/minimax-h3") {
    return MINIMAX_VIDEO_KNOWN_MODELS.find((m) => m.mode === "i2v") ?? null;
  }
  return null;
}

export function resolveMinimaxVideoUpstreamModel(modelKey: string): string {
  return MINIMAX_H3_UPSTREAM_MODEL;
}

export function resolveMinimaxVideoTaskEndpoint(
  modelKey: string,
): "/v2/video_generation" | "/v2/video_regeneration" | "/v2/h3_context_ir" {
  const spec = resolveMinimaxVideoModel(modelKey);
  if (!spec) return "/v2/video_generation";
  switch (spec.taskKind) {
    case "regeneration":
      return "/v2/video_regeneration";
    case "h3_context_ir":
      return "/v2/h3_context_ir";
    default:
      return "/v2/video_generation";
  }
}

/** 计费分档 canonical（刊例价按秒；Context IR 按 token） */
export function minimaxH3BillingCanonicalFromInput(input: {
  modelKey: string;
  resolution?: string | null;
}): string {
  const spec = resolveMinimaxVideoModel(input.modelKey);
  if (spec?.taskKind === "h3_context_ir") return "minimax-h3-context-ir";
  if (spec?.taskKind === "regeneration") return "minimax-h3-regeneration-2k";
  const res = String(input.resolution ?? "2K").trim().toUpperCase();
  if (res === "768P" || res === "768p") return "minimax-h3-768p";
  return "minimax-h3-2k";
}
