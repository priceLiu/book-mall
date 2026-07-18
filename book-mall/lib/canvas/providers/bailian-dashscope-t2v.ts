/**
 * 百炼 DashScope · 文生视频（Canvas Gateway · gateway:bailian 展示）
 */
import type { CanvasGatewayListedModel, CanvasParamSchema } from "./types";

const T2V_PARAMS_SCHEMA = [
  {
    key: "ratio",
    label: "画布比例",
    type: "select",
    options: [
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
      { value: "1:1", label: "1:1" },
    ],
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
    defaultValue: "720P",
  },
  {
    key: "duration",
    label: "时长(秒)",
    type: "select",
    options: [
      { value: 5, label: "5s" },
      { value: 10, label: "10s" },
    ],
    defaultValue: 5,
  },
  {
    key: "prompt_extend",
    label: "智能扩写",
    type: "boolean",
    defaultValue: true,
  },
] satisfies CanvasParamSchema;

export const BAILIAN_DASHSCOPE_T2V_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "wan2.6-t2v",
    displayName: "万相 2.6 · 文生视频",
    role: "VIDEO",
    description: "DashScope wan2.6-t2v · 纯文生视频",
    paramsSchema: T2V_PARAMS_SCHEMA,
    defaultParams: {
      ratio: "16:9",
      resolution: "720P",
      duration: 5,
      prompt_extend: true,
    },
  },
  {
    modelKey: "wan2.7-t2v",
    displayName: "万相 2.7 · 文生视频",
    role: "VIDEO",
    description: "DashScope wan2.7-t2v · 纯文生视频",
    paramsSchema: T2V_PARAMS_SCHEMA,
    defaultParams: {
      ratio: "16:9",
      resolution: "720P",
      duration: 5,
      prompt_extend: true,
    },
  },
];
