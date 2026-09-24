/**
 * 百炼 · DashScope 图像模型（Canvas Gateway 展示用；实际经 DASHSCOPE 凭证提交）
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

const WAN_IMAGE_RESOLUTION_SCHEMA = [
  {
    key: "resolution",
    label: "清晰度",
    type: "select",
    options: [
      { value: "1K", label: "1K" },
      { value: "2K", label: "2K" },
      { value: "4K", label: "4K" },
    ],
    defaultValue: "2K",
  },
] satisfies CanvasParamSchema;

export const BAILIAN_IMAGE_KNOWN_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "qwen-image-3.0-pro",
    displayName: "千问 Image 3.0 Pro",
    role: "IMAGE",
    description:
      "千问图像 3.0 Pro · 文生图 / 图生图（1～3 张参考）· 复杂版面与小字渲染。",
    paramsSchema: WAN_IMAGE_RESOLUTION_SCHEMA,
    defaultParams: { resolution: "2K" },
  },
  {
    modelKey: "z-image-turbo",
    displayName: "Z-Image Turbo",
    role: "IMAGE",
    description: "百炼 Z-Image · 快速低成本文生图（不支持参考图编辑）。",
    paramsSchema: WAN_IMAGE_RESOLUTION_SCHEMA,
    defaultParams: { resolution: "1K" },
  },
  {
    modelKey: "qwen-image-edit",
    displayName: "千问 · 图像编辑",
    role: "IMAGE",
    description:
      "千问图像编辑 · 须 1～3 张参考图 + 编辑指令；多图融合、文字/物体增删改。",
    paramsSchema: WAN_IMAGE_RESOLUTION_SCHEMA,
    defaultParams: { resolution: "2K" },
  },
  {
    modelKey: "qwen-image-edit-max",
    displayName: "千问 · 图像编辑 Max",
    role: "IMAGE",
    description:
      "千问图像编辑 Max · 更强几何/一致性；须参考图，可输出 1～6 张。",
    paramsSchema: WAN_IMAGE_RESOLUTION_SCHEMA,
    defaultParams: { resolution: "2K", n: 1 },
  },
  {
    modelKey: "wan2.7-image",
    displayName: "万相 2.7 · 多图参考",
    role: "IMAGE",
    description:
      "通义万相 2.7 · 文生图 / 多图参考（图生图）；与电商分镜、主图默认一致。",
    paramsSchema: WAN_IMAGE_RESOLUTION_SCHEMA,
    defaultParams: { resolution: "2K" },
  },
  {
    modelKey: "wan2.7-image-pro",
    displayName: "万相 2.7 Pro · 编辑 / 多图参考",
    role: "IMAGE",
    description:
      "通义万相 2.7 Pro · 文生图 / 多图参考图生图 / 图像编辑（须参考图 + 编辑指令）。",
    paramsSchema: WAN_IMAGE_RESOLUTION_SCHEMA,
    defaultParams: { resolution: "2K" },
  },
  {
    modelKey: "wan2.6-image",
    displayName: "万相 2.6 · 图像编辑",
    role: "IMAGE",
    description: "万相 2.6 image · 多图参考 / 图像编辑（非纯 t2i）。",
    paramsSchema: WAN_IMAGE_RESOLUTION_SCHEMA,
    defaultParams: { resolution: "2K" },
  },
  {
    modelKey: "wanx-background-generation-v2",
    displayName: "万相 · 换背景",
    role: "IMAGE",
    description:
      "万相背景生成 · 透明底主体换场景；文本 / 参考图 / 边缘引导。model_version 默认 v3。",
    paramsSchema: [
      {
        key: "model_version",
        label: "版本",
        type: "select",
        options: [
          { value: "v3", label: "v3 效果更好" },
          { value: "v2", label: "v2 更快" },
        ],
        defaultValue: "v3",
      },
      {
        key: "n",
        label: "张数",
        type: "select",
        options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ],
        defaultValue: "1",
      },
    ],
    defaultParams: { model_version: "v3", n: 1 },
  },
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
