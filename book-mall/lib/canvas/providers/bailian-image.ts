/**
 * 百炼 · 可灵等 DashScope 图像模型（Canvas Gateway 展示用；实际经 DASHSCOPE 凭证提交）
 */
import type { CanvasGatewayListedModel, CanvasParamSchema } from "./types";

const KLING_IMAGE_ASPECT_SCHEMA = [
  {
    key: "aspect_ratio",
    label: "比例",
    type: "select",
    options: [
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
      { value: "1:1", label: "1:1" },
    ],
    defaultValue: "16:9",
  },
] satisfies CanvasParamSchema;

export const BAILIAN_IMAGE_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "kling-3.0-image",
    displayName: "可灵 3.0 · 图生图",
    role: "IMAGE",
    description:
      "百炼可灵 3.0 Omni · 文生图 / 多图参考（最多 10 张）；有参考图时走图生图。",
    paramsSchema: KLING_IMAGE_ASPECT_SCHEMA,
    defaultParams: { aspect_ratio: "16:9" },
  },
];
