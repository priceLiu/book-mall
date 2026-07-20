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
    type: "number",
    min: 5,
    max: 10,
    step: 5,
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
    modelKey: "happyhorse-1.0-t2v",
    displayName: "HappyHorse-1.0-T2V",
    role: "VIDEO",
    description: "DashScope happyhorse-1.0-t2v · text-to-video",
    paramsSchema: [
      ...T2V_PARAMS_SCHEMA.slice(0, 3),
      {
        key: "duration",
        label: "duration (sec)",
        type: "number",
        min: 3,
        max: 15,
        step: 1,
        defaultValue: 5,
      },
    ],
    defaultParams: {
      ratio: "16:9",
      resolution: "720P",
      duration: 5,
    },
  },
  {
    modelKey: "happyhorse-1.1-t2v",
    displayName: "HappyHorse-1.1-T2V",
    role: "VIDEO",
    description: "DashScope happyhorse-1.1-t2v · text-to-video",
    paramsSchema: [
      ...T2V_PARAMS_SCHEMA.slice(0, 3),
      {
        key: "duration",
        label: "duration (sec)",
        type: "number",
        min: 3,
        max: 15,
        step: 1,
        defaultValue: 5,
      },
    ],
    defaultParams: {
      ratio: "16:9",
      resolution: "720P",
      duration: 5,
    },
  },
  {
    modelKey: "wan2.6-t2v",
    displayName: "Wan 2.6 T2V",
    role: "VIDEO",
    description: "DashScope wan2.6-t2v · text-to-video",
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
    displayName: "Wan 2.7 T2V",
    role: "VIDEO",
    description: "DashScope wan2.7-t2v · text-to-video",
    paramsSchema: T2V_PARAMS_SCHEMA,
    defaultParams: {
      ratio: "16:9",
      resolution: "720P",
      duration: 5,
      prompt_extend: true,
    },
  },
];
