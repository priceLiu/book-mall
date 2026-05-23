/**
 * 阿里百炼（dashscope）OpenAI 兼容入口。
 *
 * 大部分调用走 OpenAI Chat / Image 兼容；通义万相一些专属字段走 paramsSchema 透传。
 * baseUrl 默认 https://dashscope.aliyuncs.com/compatible-mode/v1
 */

import { OpenAiCompatGateway } from "./openai-compat";
import type { CanvasGatewayListedModel, CanvasParamSchema, CanvasProviderConfig } from "./types";

const BAILIAN_FALLBACK_MODELS: CanvasGatewayListedModel[] = [
  {
    modelKey: "qwen-plus",
    displayName: "通义千问 Plus",
    role: "LLM",
    description: "性能均衡，适合方案/文案。",
    paramsSchema: [
      {
        key: "temperature",
        label: "temperature",
        type: "number",
        min: 0,
        max: 2,
        step: 0.1,
        defaultValue: 0.7,
      },
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number",
        min: 256,
        max: 8000,
        step: 128,
        defaultValue: 2000,
      },
    ] satisfies CanvasParamSchema,
  },
  {
    modelKey: "qwen-max",
    displayName: "通义千问 Max",
    role: "LLM",
    description: "效果优先；耗时更长。",
  },
  {
    modelKey: "wanx-v1",
    displayName: "通义万相 v1（图像）",
    role: "IMAGE",
    description: "通义万相文生图。",
    paramsSchema: [
      {
        key: "size",
        label: "尺寸",
        type: "select",
        options: [
          { value: "1024*1024", label: "1024×1024" },
          { value: "1280*720", label: "1280×720（16:9）" },
          { value: "720*1280", label: "720×1280（9:16）" },
        ],
        defaultValue: "1024*1024",
      },
      {
        key: "n",
        label: "数量",
        type: "number",
        min: 1,
        max: 4,
        step: 1,
        defaultValue: 1,
      },
    ] satisfies CanvasParamSchema,
  },
];

export class AliBailianGateway extends OpenAiCompatGateway {
  constructor(config: CanvasProviderConfig) {
    super(config, {
      kind: "ALI_BAILIAN",
      defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      fallbackModels: BAILIAN_FALLBACK_MODELS,
    });
  }
}
