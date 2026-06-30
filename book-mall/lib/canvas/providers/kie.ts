/**
 * KIE.AI gateway：包装现有 kie-client.ts + gemini-llm-client.ts。
 *
 * KIE 没有公开的 /models 列表接口，所以这里硬编码当前主流模型清单。
 * 用户在 settings 页面能选择启用其中哪些。
 */

import {
  createKieTaskWithKey,
  extractKieResultUrl,
  getKieTaskWithKey,
  KieError,
  type KieAspectRatio,
  type KieImageInput,
} from "@/lib/story/kie-client";

import { resolveKieApiRoot, resolveKieGeminiChatPath } from "@/lib/gateway/model-router";
import { gatewayFetch } from "@/lib/gateway/format-fetch-error";
import {
  buildKieCodexResponsesBody,
  isKieCodexChatModel,
  kieCodexResponseToChatCompletions,
} from "@/lib/gateway/kie-codex-chat";
import { buildKieGrokTextToImageCreateArgs } from "@/lib/canvas/kie-grok-builders";

import {
  CanvasGatewayError,
  getDefaultProviderBaseUrl,
  type CanvasGatewayChatRequest,
  type CanvasGatewayChatResponse,
  type CanvasGatewayImageRequest,
  type CanvasGatewayImageTask,
  type CanvasGatewayListModelsResult,
  type CanvasGatewayPollResult,
  type CanvasParamSchema,
  type CanvasProviderConfig,
  type CanvasProviderGateway,
} from "./types";

const STD_IMAGE_ASPECT_SCHEMA = [
  {
    key: "aspect_ratio",
    label: "比例",
    type: "select",
    options: [
      { value: "1:1", label: "1:1" },
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
    ],
    defaultValue: "1:1",
  },
] satisfies CanvasParamSchema;

const SEEDREAM_ASPECT_SCHEMA = [
  {
    key: "aspect_ratio",
    label: "比例",
    type: "select",
    options: [
      { value: "1:1", label: "1:1" },
      { value: "4:3", label: "4:3" },
      { value: "3:4", label: "3:4" },
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
      { value: "2:3", label: "2:3" },
      { value: "3:2", label: "3:2" },
      { value: "21:9", label: "21:9" },
    ],
    defaultValue: "1:1",
  },
  {
    key: "quality",
    label: "画质",
    type: "select",
    options: [
      { value: "basic", label: "basic（2K）" },
      { value: "high", label: "high（4K）" },
    ],
    defaultValue: "basic",
  },
] satisfies CanvasParamSchema;

function pickSeedreamQuality(params: Record<string, unknown>): "basic" | "high" {
  return params.quality === "high" ? "high" : "basic";
}

function pickFlux2Resolution(params: Record<string, unknown>): "1K" | "2K" {
  return params.resolution === "1K" ? "1K" : "2K";
}

function qwenImageSizeFromAspect(aspect: string): string {
  const map: Record<string, string> = {
    "1:1": "square_hd",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
  };
  return map[aspect] ?? "square_hd";
}

type KieChatChoice = {
  finish_reason?: string;
  message?: Record<string, unknown>;
};

/** 从 KIE Gemini chat message 提取文本（兼容 string / 多模态 array / reasoning 字段）。 */
function extractKieChatText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";

  const raw = message.content;
  if (typeof raw === "string" && raw.trim()) return raw.trim();

  if (Array.isArray(raw)) {
    const parts: string[] = [];
    for (const part of raw) {
      if (typeof part === "string" && part.trim()) {
        parts.push(part.trim());
        continue;
      }
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "text" && typeof p.text === "string" && p.text.trim()) {
        parts.push(p.text.trim());
      }
    }
    if (parts.length) return parts.join("\n").trim();
  }

  for (const key of [
    "reasoning_content",
    "reasoning",
    "thoughts",
    "reasoning_text",
  ]) {
    const v = message[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const refusal = message.refusal;
  if (typeof refusal === "string" && refusal.trim()) return refusal.trim();

  return "";
}

/** KIE 业务错误常包在 HTTP 200 的 { code, msg, data } 里，而非 OpenAI choices。 */
function throwIfKieEnvelopeError(parsed: unknown): void {
  if (!parsed || typeof parsed !== "object") return;
  const obj = parsed as Record<string, unknown>;
  const code = obj.code;
  if (typeof code !== "number") return;
  if (Array.isArray(obj.choices) && obj.choices.length > 0) return;

  const msg =
    (typeof obj.msg === "string" && obj.msg.trim()) ||
    (typeof obj.message === "string" && obj.message.trim()) ||
    `KIE API error (${code})`;

  if (code === 402 || /quota|insufficient|credit|balance/i.test(msg)) {
    throw new CanvasGatewayError(
      "PROVIDER_QUOTA_EXCEEDED",
      "KIE 余额不足，请充值后重试",
      402,
      false,
    );
  }
  if (code === 401 || code === 403) {
    throw new CanvasGatewayError("PROVIDER_AUTH_ERROR", msg, code, false);
  }
  if (code === 429) {
    throw new CanvasGatewayError("PROVIDER_HTTP_ERROR", msg, 429, true);
  }
  if (code !== 200) {
    throw new CanvasGatewayError(
      "PROVIDER_HTTP_ERROR",
      `KIE chat error ${code}: ${msg.slice(0, 400)}`,
      code >= 400 && code < 600 ? code : 502,
      code >= 500,
    );
  }
}

function kieChatEmptyError(choice: KieChatChoice | undefined, rawBody: string): never {
  if (/credits insufficient|quota|余额/i.test(rawBody)) {
    throw new CanvasGatewayError(
      "PROVIDER_QUOTA_EXCEEDED",
      "KIE 余额不足，请充值后重试",
      402,
      false,
    );
  }
  const finish = choice?.finish_reason ?? "unknown";
  const snippet = rawBody.slice(0, 280).replace(/\s+/g, " ");
  throw new CanvasGatewayError(
    "PROVIDER_INVALID_RESPONSE",
    `KIE chat empty content (finish_reason=${finish})${snippet ? `: ${snippet}` : ""}`,
  );
}

const GEMINI_3_FLASH_LLM_PARAMS = [
  {
    key: "reasoning_effort",
    label: "推理深度",
    type: "select",
    options: [
      { value: "low", label: "low（快）" },
      { value: "high", label: "high（深，慢）" },
    ],
    defaultValue: "low",
  },
  {
    key: "max_tokens",
    label: "max_tokens",
    type: "number",
    min: 256,
    max: 16000,
    step: 128,
    defaultValue: 16000,
    help: "输出 token 上限；故事大纲等长文本推荐 16000。",
  },
  {
    key: "temperature",
    label: "temperature",
    type: "number",
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 0.7,
  },
] satisfies CanvasParamSchema;

const GEMINI_3_FLASH_LLM_DEFAULTS = {
  reasoning_effort: "low",
  max_tokens: 16000,
  temperature: 0.7,
};

const GPT_55_LLM_PARAMS = [
  {
    key: "reasoning_effort",
    label: "推理深度",
    type: "select",
    options: [
      { value: "low", label: "low（快）" },
      { value: "medium", label: "medium" },
      { value: "high", label: "high（深）" },
      { value: "xhigh", label: "xhigh（最深）" },
    ],
    defaultValue: "low",
  },
  {
    key: "temperature",
    label: "temperature",
    type: "number",
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 0.7,
  },
] satisfies CanvasParamSchema;

const GPT_55_LLM_DEFAULTS = {
  reasoning_effort: "low",
  temperature: 0.7,
};

export const KIE_KNOWN_MODELS: CanvasGatewayListModelsResult["models"] = [
  {
    modelKey: "google/gemini-3-flash-preview",
    displayName: "Gemini 3 Flash Preview (KIE)",
    role: "LLM",
    description:
      "与 story-web 生成故事大纲同款；多模态理解 + 文本生成（KIE gemini-3-flash 端点）。",
    paramsSchema: GEMINI_3_FLASH_LLM_PARAMS,
    defaultParams: GEMINI_3_FLASH_LLM_DEFAULTS,
  },
  {
    modelKey: "gemini-3-flash",
    displayName: "Gemini 3 Flash (KIE · 多模态)",
    role: "LLM",
    description:
      "多模态视觉理解 + 文本生成。上游连接产品图 / 风格图 / 参数即可直接出设计方案。",
    paramsSchema: GEMINI_3_FLASH_LLM_PARAMS,
    defaultParams: GEMINI_3_FLASH_LLM_DEFAULTS,
  },
  {
    modelKey: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash (KIE)",
    role: "LLM",
    description:
      "Google Gemini 2.5 Flash · 快速多模态 · 提示词优化 / Story 文案推荐。",
    paramsSchema: GEMINI_3_FLASH_LLM_PARAMS,
    defaultParams: GEMINI_3_FLASH_LLM_DEFAULTS,
  },
  {
    modelKey: "gpt-5-5",
    displayName: "GPT-5.5 Chat (KIE)",
    role: "LLM",
    description:
      "OpenAI GPT-5.5 · 复杂推理 / 工业化剧本与分镜脚本；经 KIE codex responses 端点。",
    paramsSchema: GPT_55_LLM_PARAMS,
    defaultParams: GPT_55_LLM_DEFAULTS,
  },
  {
    modelKey: "nano-banana-pro",
    displayName: "Nano Banana Pro (KIE)",
    role: "IMAGE",
    description: "通用图像生成 / 风格融合，支持多张参考图。",
    paramsSchema: [
      {
        key: "aspect_ratio",
        label: "比例",
        type: "select",
        options: [
          { value: "1:1", label: "1:1" },
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
        ],
        defaultValue: "1:1",
      },
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "1K", label: "1K" },
          { value: "2K", label: "2K" },
          { value: "4K", label: "4K" },
        ],
        defaultValue: "2K",
        help: "2K 细节更好，积分消耗略高。",
      },
      {
        key: "output_format",
        label: "格式",
        type: "select",
        options: [
          { value: "png", label: "png" },
          { value: "jpeg", label: "jpeg" },
          { value: "webp", label: "webp" },
        ],
        defaultValue: "png",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { aspect_ratio: "1:1", resolution: "2K", output_format: "png" },
  },
  {
    modelKey: "flux-2-pro",
    displayName: "Flux-2 Pro (KIE · 文生图)",
    role: "IMAGE",
    description: "Black Forest Labs Flux-2 Pro · 高质量写实；有参考图时走图生图。",
    paramsSchema: [
      ...STD_IMAGE_ASPECT_SCHEMA,
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "1K", label: "1K" },
          { value: "2K", label: "2K" },
        ],
        defaultValue: "2K",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { aspect_ratio: "1:1", resolution: "2K" },
  },
  {
    modelKey: "seedream-5-lite",
    displayName: "Seedream 5.0 Lite (KIE · 文生图)",
    role: "IMAGE",
    description: "字节 Seedream 5 Lite · 写实文生图；有参考图时自动走图生图。",
    paramsSchema: SEEDREAM_ASPECT_SCHEMA,
    defaultParams: { aspect_ratio: "1:1", quality: "basic" },
  },
  {
    modelKey: "seedream-4.5",
    displayName: "Seedream 4.5 (KIE · 文生图)",
    role: "IMAGE",
    description: "Seedream 4.5 · 高质量写实；有参考图时走 Edit。",
    paramsSchema: SEEDREAM_ASPECT_SCHEMA,
    defaultParams: { aspect_ratio: "1:1", quality: "basic" },
  },
  {
    modelKey: "gpt-image-2",
    displayName: "GPT Image 2 (KIE · 文生图)",
    role: "IMAGE",
    description: "OpenAI GPT Image 2 · 海报 / 排版；有参考图时走图生图。",
    paramsSchema: [
      ...STD_IMAGE_ASPECT_SCHEMA,
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "1K", label: "1K" },
          { value: "2K", label: "2K" },
          { value: "4K", label: "4K" },
        ],
        defaultValue: "2K",
        help: "4K 不支持 1:1 比例。",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { aspect_ratio: "1:1", resolution: "2K" },
  },
  {
    modelKey: "gpt-image-1",
    displayName: "GPT Image 1.5 (KIE · 文生图)",
    role: "IMAGE",
    description: "GPT Image 1.5 · 排版 / 平面海报；有参考图时走图生图。",
    paramsSchema: [
      ...STD_IMAGE_ASPECT_SCHEMA,
      {
        key: "quality",
        label: "画质",
        type: "select",
        options: [
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
        ],
        defaultValue: "medium",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { aspect_ratio: "1:1", quality: "medium" },
  },
  {
    modelKey: "qwen-text-to-image",
    displayName: "Qwen (KIE · 文生图)",
    role: "IMAGE",
    description: "通义 Qwen 写实文生图；有参考图时走图生图。",
    paramsSchema: [
      ...STD_IMAGE_ASPECT_SCHEMA,
      {
        key: "output_format",
        label: "格式",
        type: "select",
        options: [
          { value: "png", label: "png" },
          { value: "jpeg", label: "jpeg" },
        ],
        defaultValue: "png",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { aspect_ratio: "1:1", output_format: "png" },
  },
  {
    modelKey: "grok-imagine/text-to-image",
    displayName: "Grok Imagine · 文生图 (KIE)",
    role: "IMAGE",
    description: "xAI Grok Imagine · 文生图；有参考图时走图生图（image-to-video 请选视频模型）。",
    paramsSchema: [
      {
        key: "aspect_ratio",
        label: "比例",
        type: "select",
        options: [
          { value: "1:1", label: "1:1" },
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
          { value: "3:2", label: "3:2" },
          { value: "2:3", label: "2:3" },
        ],
        defaultValue: "1:1",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { aspect_ratio: "1:1" },
  },
  {
    modelKey: "grok-imagine/image-to-video",
    displayName: "Grok Imagine · 图生视频 (KIE)",
    role: "VIDEO",
    description: "xAI Grok Imagine · 单图/多图驱动视频（image_urls）。",
    paramsSchema: [
      {
        key: "mode",
        label: "风格",
        type: "select",
        options: [
          { value: "normal", label: "normal" },
          { value: "fun", label: "fun" },
          { value: "spicy", label: "spicy（无外链图）" },
        ],
        defaultValue: "normal",
      },
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "480p", label: "480p" },
          { value: "720p", label: "720p" },
        ],
        defaultValue: "720p",
      },
      {
        key: "duration",
        label: "时长(秒)",
        type: "number",
        min: 6,
        max: 30,
        step: 1,
        defaultValue: 6,
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { mode: "normal", resolution: "720p", duration: 6 },
  },
  {
    modelKey: "grok-imagine-video-1-5-preview",
    displayName: "Grok Imagine Video 1.5 (KIE)",
    role: "VIDEO",
    description: "xAI Grok Imagine Video 1.5 · 图生视频 · 原生音频。",
    paramsSchema: [
      {
        key: "aspect_ratio",
        label: "比例",
        type: "select",
        options: [
          { value: "auto", label: "auto" },
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
          { value: "1:1", label: "1:1" },
        ],
        defaultValue: "auto",
      },
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "480p", label: "480p" },
          { value: "720p", label: "720p" },
        ],
        defaultValue: "720p",
      },
      {
        key: "duration",
        label: "时长(秒)",
        type: "number",
        min: 1,
        max: 15,
        step: 1,
        defaultValue: 8,
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { aspect_ratio: "auto", resolution: "720p", duration: 8 },
  },
  {
    modelKey: "wan/2-6-video-to-video",
    displayName: "Wan 2.6 · 视频生视频 (KIE)",
    role: "VIDEO",
    description: "通义万相 2.6 · 按提示词改造已有视频。",
    paramsSchema: [
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p" },
        ],
        defaultValue: "1080p",
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
    ] satisfies CanvasParamSchema,
    defaultParams: { resolution: "1080p", duration: 5 },
  },
  {
    modelKey: "kling-2.6/motion-control",
    displayName: "Kling 2.6 · Motion Control (KIE)",
    role: "VIDEO",
    description: "可灵 2.6 · 参考图 + 动作视频驱动角色。",
    paramsSchema: [
      {
        key: "mode",
        label: "画质",
        type: "select",
        options: [
          { value: "std", label: "std (720p)" },
          { value: "pro", label: "pro (1080p)" },
        ],
        defaultValue: "std",
      },
      {
        key: "character_orientation",
        label: "朝向参考",
        type: "select",
        options: [
          { value: "video", label: "video" },
          { value: "image", label: "image" },
        ],
        defaultValue: "video",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { mode: "std", character_orientation: "video" },
  },
  {
    modelKey: "kling-3.0/motion-control",
    displayName: "Kling 3.0 · Motion Control (KIE)",
    role: "VIDEO",
    description: "可灵 3.0 · 参考图 + 动作视频驱动角色。",
    paramsSchema: [
      {
        key: "mode",
        label: "画质",
        type: "select",
        options: [
          { value: "std", label: "std (720p)" },
          { value: "pro", label: "pro (1080p)" },
        ],
        defaultValue: "pro",
      },
      {
        key: "character_orientation",
        label: "朝向参考",
        type: "select",
        options: [
          { value: "video", label: "video" },
          { value: "image", label: "image" },
        ],
        defaultValue: "video",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { mode: "pro", character_orientation: "video" },
  },
  {
    modelKey: "topaz/video-upscale",
    displayName: "Topaz · 视频超分 (KIE)",
    role: "VIDEO",
    description: "Topaz AI · 视频分辨率增强。",
    paramsSchema: [
      {
        key: "upscale_factor",
        label: "放大倍数",
        type: "select",
        options: [
          { value: "1", label: "1×" },
          { value: "2", label: "2×" },
          { value: "4", label: "4×" },
        ],
        defaultValue: "2",
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { upscale_factor: "2" },
  },
  {
    modelKey: "kling-2.6/image-to-video",
    displayName: "Kling 2.6 i2v (KIE)",
    role: "VIDEO",
    description: "快手可灵 · 图生视频。",
    paramsSchema: [
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
        key: "generateAudio",
        label: "生成配音",
        type: "boolean",
        defaultValue: true,
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { duration: 5, generateAudio: true },
  },
  {
    modelKey: "kling/v3-turbo-image-to-video",
    displayName: "Kling 3.0 Turbo i2v (KIE)",
    role: "VIDEO",
    description: "快手可灵 3.0 Turbo · 图生视频；首帧 / 首尾帧（image_urls 首+尾），速度优先。",
    paramsSchema: [
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p" },
        ],
        defaultValue: "720p",
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
    ] satisfies CanvasParamSchema,
    defaultParams: { resolution: "720p", duration: 5 },
  },
  {
    modelKey: "kling/v3-turbo-text-to-video",
    displayName: "Kling 3.0 Turbo t2v (KIE)",
    role: "VIDEO",
    description: "快手可灵 3.0 Turbo · 文生视频；纯提示词成片，速度优先。",
    paramsSchema: [
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p" },
        ],
        defaultValue: "720p",
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
    ] satisfies CanvasParamSchema,
    defaultParams: { resolution: "720p", duration: 5 },
  },
  {
    modelKey: "kling-3.0/video",
    displayName: "Kling 3.0 图/文生视频 (KIE)",
    role: "VIDEO",
    description: "快手可灵 3.0 · 图生/文生视频；非多镜头时可首尾帧（image_urls 首+尾），支持元素引用；std/pro 画质。",
    paramsSchema: [
      {
        key: "mode",
        label: "画质",
        type: "select",
        options: [
          { value: "std", label: "std (标准)" },
          { value: "pro", label: "pro (高清)" },
        ],
        defaultValue: "pro",
      },
      {
        key: "aspect_ratio",
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
        key: "duration",
        label: "时长(秒)",
        type: "number",
        min: 3,
        max: 15,
        step: 1,
        defaultValue: 5,
      },
      {
        key: "multi_shots",
        label: "多镜头",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "sound",
        label: "生成音效",
        type: "boolean",
        defaultValue: true,
      },
    ] satisfies CanvasParamSchema,
    defaultParams: {
      mode: "pro",
      aspect_ratio: "16:9",
      duration: 5,
      multi_shots: false,
      sound: true,
    },
  },
  {
    modelKey: "kling/ai-avatar-standard",
    displayName: "Kling AI Avatar 标准 (KIE)",
    role: "VIDEO",
    description:
      "快手可灵 · AI 数字人；上传头像图 + 音频，生成口型同步的数字人视频。",
    paramsSchema: [] satisfies CanvasParamSchema,
    defaultParams: {},
  },
  {
    modelKey: "kling/ai-avatar-pro",
    displayName: "Kling AI Avatar Pro (KIE)",
    role: "VIDEO",
    description:
      "快手可灵 · AI 数字人 Pro；上传头像图 + 音频，更高质量口型同步数字人视频。",
    paramsSchema: [] satisfies CanvasParamSchema,
    defaultParams: {},
  },
  {
    modelKey: "bytedance/seedance-2",
    displayName: "Seedance 2 (KIE · 图生视频)",
    role: "VIDEO",
    description: "字节豆包 · 分镜图驱动视频。",
    paramsSchema: [
      {
        key: "aspect_ratio",
        label: "画布比例",
        type: "select",
        options: [
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
          { value: "3:4", label: "3:4" },
          { value: "4:3", label: "4:3" },
          { value: "1:1", label: "1:1" },
        ],
        defaultValue: "16:9",
      },
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "480p", label: "480p" },
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p" },
        ],
        defaultValue: "1080p",
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
        key: "generateAudio",
        label: "生成配音",
        type: "boolean",
        defaultValue: true,
      },
    ] satisfies CanvasParamSchema,
    defaultParams: {
      aspect_ratio: "16:9",
      resolution: "1080p",
      duration: 5,
      generateAudio: true,
    },
  },
  {
    modelKey: "wan/2-7-image-to-video",
    displayName: "Wan 2.7 i2v (KIE)",
    role: "VIDEO",
    description: "通义万相 · 图生视频；first_frame_url / last_frame_url 首尾帧，全能参考为单首帧。",
    paramsSchema: [
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p" },
        ],
        defaultValue: "1080p",
      },
      {
        key: "duration",
        label: "时长(秒)",
        type: "number",
        min: 2,
        max: 15,
        step: 1,
        defaultValue: 5,
      },
    ] satisfies CanvasParamSchema,
    defaultParams: { resolution: "1080p", duration: 5 },
  },
  {
    modelKey: "happyhorse/image-to-video",
    displayName: "Happy Horse i2v (KIE)",
    role: "VIDEO",
    description: "Happy Horse · 图生视频。",
    paramsSchema: [
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        options: [
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p" },
        ],
        defaultValue: "1080p",
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
    ] satisfies CanvasParamSchema,
    defaultParams: { resolution: "1080p", duration: 5 },
  },
];

/** 画布 modelKey → KIE createTask 的 model + input（含 gpt-image-1 映射） */
export function buildKieImageCreateArgs(args: {
  modelKey: string;
  prompt: string;
  imageUrls?: string[];
  params?: Record<string, unknown>;
}): { model: string; input: Record<string, unknown> } {
  const params = args.params ?? {};
  const aspect = (params.aspect_ratio as KieAspectRatio | undefined) ?? "1:1";
  const imageUrls = (args.imageUrls ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  const hasRefs = imageUrls.length > 0;

  if (args.modelKey === "grok-imagine/text-to-image") {
    return buildKieGrokTextToImageCreateArgs({
      prompt: args.prompt,
      aspectRatio: String(params.aspect_ratio ?? "1:1"),
      enablePro: params.enable_pro === true,
    });
  }

  if (args.modelKey === "gpt-image-1") {
    const quality =
      params.quality === "high" || params.quality === "medium"
        ? params.quality
        : "medium";
    const input: Record<string, unknown> = {
      prompt: args.prompt,
      aspect_ratio: aspect,
      quality,
    };
    if (hasRefs) {
      return {
        model: "gpt-image/1.5-image-to-image",
        input: { ...input, input_urls: imageUrls },
      };
    }
    return {
      model: "gpt-image/1.5-text-to-image",
      input,
    };
  }

  if (args.modelKey === "seedream-5-lite") {
    const quality = pickSeedreamQuality(params);
    const input: Record<string, unknown> = {
      prompt: args.prompt,
      aspect_ratio: aspect,
      quality,
    };
    if (hasRefs) {
      return {
        model: "seedream/5-lite-image-to-image",
        input: { ...input, image_urls: imageUrls },
      };
    }
    return { model: "seedream/5-lite-text-to-image", input };
  }

  if (args.modelKey === "seedream-4.5") {
    const quality = pickSeedreamQuality(params);
    const input: Record<string, unknown> = {
      prompt: args.prompt,
      aspect_ratio: aspect,
      quality,
    };
    if (hasRefs) {
      return {
        model: "seedream/4.5-edit",
        input: { ...input, image_urls: imageUrls },
      };
    }
    return { model: "seedream/4.5-text-to-image", input };
  }

  if (args.modelKey === "gpt-image-2") {
    const resolution =
      params.resolution === "1K" ||
      params.resolution === "2K" ||
      params.resolution === "4K"
        ? params.resolution
        : "2K";
    const input: Record<string, unknown> = {
      prompt: args.prompt,
      aspect_ratio: aspect,
      resolution,
    };
    if (hasRefs) {
      return {
        model: "gpt-image-2-image-to-image",
        input: { ...input, input_urls: imageUrls },
      };
    }
    return { model: "gpt-image-2-text-to-image", input };
  }

  if (args.modelKey === "flux-2-pro") {
    const resolution = pickFlux2Resolution(params);
    const input: Record<string, unknown> = {
      prompt: args.prompt,
      aspect_ratio: aspect,
      resolution,
    };
    if (hasRefs) {
      return {
        model: "flux-2/pro-image-to-image",
        input: { ...input, input_urls: imageUrls },
      };
    }
    return { model: "flux-2/pro-text-to-image", input };
  }

  if (args.modelKey === "qwen-text-to-image") {
    const output_format = params.output_format === "jpeg" ? "jpeg" : "png";
    if (hasRefs) {
      return {
        model: "qwen/image-to-image",
        input: {
          prompt: args.prompt,
          image_url: imageUrls[0],
          output_format,
        },
      };
    }
    return {
      model: "qwen/text-to-image",
      input: {
        prompt: args.prompt,
        image_size: qwenImageSizeFromAspect(aspect),
        output_format,
      },
    };
  }

  const resolution = (params.resolution as "1K" | "2K" | undefined) ?? "2K";
  const output_format =
    (params.output_format as "png" | "jpeg" | "webp" | undefined) ?? "png";
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    aspect_ratio: aspect,
    resolution,
    output_format,
  };
  if (hasRefs) input.image_input = imageUrls;
  if (params.n && Number(params.n) > 1) input.n = params.n;
  return { model: args.modelKey, input };
}

export class KieGateway implements CanvasProviderGateway {
  readonly kind = "KIE" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: CanvasProviderConfig) {
    if (!config.apiKey) {
      throw new CanvasGatewayError(
        "PROVIDER_NOT_CONFIGURED",
        "KIE provider 缺少 apiKey",
      );
    }
    this.apiKey = config.apiKey;
    this.baseUrl = resolveKieApiRoot(
      config.baseUrl?.trim() || getDefaultProviderBaseUrl("KIE") || null,
    );
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    // 调一个最便宜的 chat（max_tokens 32 的 echo），验证 key + 网络
    try {
      const body = {
        messages: [{ role: "user", content: "ping" }],
        stream: false,
        include_thoughts: false,
        max_tokens: 16,
      };
      const r = await gatewayFetch(
        `${this.baseUrl}/gemini-3-flash/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        },
        { hop: "upstream", providerKind: "KIE" },
      );
      if (r.status === 401 || r.status === 403) {
        return { ok: false, message: `auth failed (HTTP ${r.status})` };
      }
      if (!r.ok) {
        const txt = await r.text();
        return { ok: false, message: `HTTP ${r.status}: ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async listModels(): Promise<CanvasGatewayListModelsResult> {
    return { models: KIE_KNOWN_MODELS, fromHardcoded: true };
  }

  async chat(req: CanvasGatewayChatRequest): Promise<CanvasGatewayChatResponse> {
    if (isKieCodexChatModel(req.modelKey)) {
      const url = `${this.baseUrl}/codex/v1/responses`;
      const body = buildKieCodexResponsesBody({
        model: req.modelKey,
        messages: req.messages,
        reasoning_effort: req.params?.reasoning_effort,
        temperature: req.params?.temperature,
      });
      const r = await gatewayFetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        },
        { hop: "upstream", providerKind: "KIE" },
      );
      const text = await r.text();
      if (!r.ok) {
        throw new CanvasGatewayError(
          "PROVIDER_HTTP_ERROR",
          `KIE GPT-5.5 HTTP ${r.status}: ${text.slice(0, 400)}`,
        );
      }
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        throw new CanvasGatewayError(
          "PROVIDER_INVALID_RESPONSE",
          `non-JSON KIE GPT-5.5 body: ${text.slice(0, 200)}`,
        );
      }
      throwIfKieEnvelopeError(parsed);
      const chatJson = kieCodexResponseToChatCompletions(parsed, req.modelKey);
      const choice = (chatJson.choices as KieChatChoice[] | undefined)?.[0];
      const out = extractKieChatText(choice?.message);
      if (!out) kieChatEmptyError(choice, text);
      const usage = chatJson.usage as {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      return {
        text: out,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
      };
    }

    const geminiPath = resolveKieGeminiChatPath(req.modelKey);
    const url = `${this.baseUrl}/${geminiPath}/v1/chat/completions`;

    const callOnce = async (
      includeThoughts: boolean,
    ): Promise<{
      text: string;
      parsed: unknown;
      usage?: CanvasGatewayChatResponse["usage"];
    }> => {
      const body: Record<string, unknown> = {
        messages: req.messages,
        stream: false,
        include_thoughts: includeThoughts,
      };
      if (req.params) {
        const { reasoning_effort, max_tokens, temperature } = req.params as Record<
          string,
          unknown
        >;
        if (reasoning_effort) body.reasoning_effort = reasoning_effort;
        if (max_tokens) body.max_tokens = max_tokens;
        if (temperature !== undefined) body.temperature = temperature;
      }
      const r = await gatewayFetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        },
        { hop: "upstream", providerKind: "KIE" },
      );
      const text = await r.text();
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          throw new CanvasGatewayError(
            "PROVIDER_AUTH_ERROR",
            `KIE auth failed: ${text.slice(0, 200)}`,
            r.status,
            false,
          );
        }
        if (r.status === 402 || /quota|insufficient|balance/i.test(text)) {
          throw new CanvasGatewayError(
            "PROVIDER_QUOTA_EXCEEDED",
            "KIE 配额不足",
            402,
            false,
          );
        }
        throw new CanvasGatewayError(
          "PROVIDER_HTTP_ERROR",
          `KIE chat HTTP ${r.status}: ${text.slice(0, 400)}`,
        );
      }
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        throw new CanvasGatewayError(
          "PROVIDER_INVALID_RESPONSE",
          `non-JSON KIE chat body: ${text.slice(0, 200)}`,
        );
      }
      throwIfKieEnvelopeError(parsed);
      const obj = parsed as {
        choices?: KieChatChoice[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const choice = obj.choices?.[0];
      const out = extractKieChatText(choice?.message);
      if (!out) {
        return { text: "", parsed, usage: undefined };
      }
      return {
        text: out,
        parsed,
        usage: {
          promptTokens: obj.usage?.prompt_tokens,
          completionTokens: obj.usage?.completion_tokens,
          totalTokens: obj.usage?.total_tokens,
        },
      };
    };

    let result = await callOnce(false);
    if (!result.text.trim()) {
      result = await callOnce(true);
    }
    if (!result.text.trim()) {
      const choice = (result.parsed as { choices?: KieChatChoice[] })?.choices?.[0];
      kieChatEmptyError(choice, JSON.stringify(result.parsed ?? {}).slice(0, 500));
    }

    return {
      text: result.text,
      rawPayload: result.parsed,
      usage: result.usage,
    };
  }

  async createImageTask(
    req: CanvasGatewayImageRequest,
  ): Promise<CanvasGatewayImageTask> {
    const { model, input } = buildKieImageCreateArgs({
      modelKey: req.modelKey,
      prompt: req.prompt,
      imageUrls: req.imageUrls,
      params: req.params as Record<string, unknown> | undefined,
    });

    try {
      const { taskId } = await createKieTaskWithKey(this.apiKey, {
        model,
        input: input as KieImageInput,
        callBackUrl: req.callBackUrl ?? null,
      });
      return { mode: "async", taskId };
    } catch (e) {
      if (e instanceof KieError) {
        throw new CanvasGatewayError(
          e.code === "KIE_NOT_CONFIGURED"
            ? "PROVIDER_NOT_CONFIGURED"
            : "PROVIDER_HTTP_ERROR",
          e.message,
          e.httpStatus,
          e.retryable,
        );
      }
      throw e;
    }
  }

  async pollImageTask(
    taskId: string,
    _opts?: { modelKey?: string },
  ): Promise<CanvasGatewayPollResult> {
    try {
      const record = await getKieTaskWithKey(this.apiKey, taskId);
      if (record.state === "success") {
        const url = extractKieResultUrl(record);
        return {
          state: "succeeded",
          resultUrls: url ? [url] : [],
          rawPayload: record,
        };
      }
      if (record.state === "fail") {
        return {
          state: "failed",
          errorCode: record.failCode,
          errorMessage: record.failMsg,
          rawPayload: record,
        };
      }
      return { state: "running", rawPayload: record };
    } catch (e) {
      if (e instanceof KieError) {
        if (e.code === "KIE_TASK_NOT_FOUND") {
          return {
            state: "failed",
            errorCode: e.code,
            errorMessage: e.message,
          };
        }
      }
      throw e;
    }
  }
}
