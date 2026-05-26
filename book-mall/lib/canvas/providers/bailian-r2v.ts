/**
 * 百炼 DashScope · 参考生视频（HappyHorse / 万相 R2V）
 */
import type { CanvasGatewayListedModel, CanvasParamSchema } from "./types";

const R2V_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "1:1", label: "1:1" },
];

const R2V_PARAMS_SCHEMA = [
  {
    key: "ratio",
    label: "画布比例",
    type: "select",
    options: R2V_RATIO_OPTIONS,
    defaultValue: "16:9",
  },
  {
    key: "resolution",
    label: "清晰度",
    type: "select",
    options: [
      { value: "720P", label: "720P" },
      { value: "1080P", label: "1080P" },
    ],
    defaultValue: "1080P",
  },
  {
    key: "duration",
    label: "时长(秒)",
    type: "number",
    min: 3,
    max: 15,
    step: 1,
    defaultValue: 5,
  },
  {
    key: "seed",
    label: "随机种子",
    type: "text",
    defaultValue: "",
  },
] satisfies CanvasParamSchema;

const WAN_EXTRA_SCHEMA = [
  {
    key: "prompt_extend",
    label: "智能扩写",
    type: "boolean",
    defaultValue: true,
  },
] satisfies CanvasParamSchema;

export const BAILIAN_R2V_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "happyhorse-1.0-r2v",
    displayName: "HappyHorse-1.0-R2V",
    role: "VIDEO",
    description: "百炼参考生视频 · 多图角色/道具一致性（1～9 张）",
    paramsSchema: R2V_PARAMS_SCHEMA,
    defaultParams: {
      ratio: "16:9",
      resolution: "1080P",
      duration: 5,
      seed: "",
    },
  },
  {
    modelKey: "wan2.6-r2v",
    displayName: "万相 2.6 · 参考生视频",
    role: "VIDEO",
    description: "百炼 wan2.6-r2v · 多图参考（1～9 张）",
    paramsSchema: [...R2V_PARAMS_SCHEMA, ...WAN_EXTRA_SCHEMA],
    defaultParams: {
      ratio: "16:9",
      resolution: "1080P",
      duration: 5,
      seed: "",
      prompt_extend: true,
    },
  },
  {
    modelKey: "wan2.7-r2v",
    displayName: "万相 2.7 · 参考生视频",
    role: "VIDEO",
    description: "百炼 wan2.7-r2v · 多图参考（1～9 张）",
    paramsSchema: [...R2V_PARAMS_SCHEMA, ...WAN_EXTRA_SCHEMA],
    defaultParams: {
      ratio: "16:9",
      resolution: "1080P",
      duration: 5,
      seed: "",
      prompt_extend: true,
    },
  },
];

export const BAILIAN_R2V_MODEL_IDS = BAILIAN_R2V_KNOWN_MODELS.map(
  (m) => m.modelKey,
);
