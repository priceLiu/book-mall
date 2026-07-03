import type {
  CanvasModelRole,
  GatewayProviderKind,
  GatewayRequestKind,
  ModelMediaKind,
} from "@prisma/client";

import {
  MINIMAX_MUSIC_MODELS,
  MINIMAX_SPEECH_MODELS,
} from "@/lib/gateway/minimax-speech-models";

type CanonicalModelDef = {
  canonicalModelKey: string;
  displayName: string;
  description?: string;
  mediaKind: ModelMediaKind;
  role: CanvasModelRole;
  requestKind: GatewayRequestKind;
  appTags: string[];
  sortOrder: number;
  routes: Array<{
    vendor: string;
    modelKey: string;
    providerKind: GatewayProviderKind;
  }>;
  primaryVendor: string;
  billingKind?: "PER_IMAGE" | "PER_SECOND" | "PER_1K_TOKENS" | "PER_CALL";
  unitLabel?: string;
};

/**
 * 历史/工具站直接提交的 vendor modelKey（未走 canonical 选模 UI）。
 * 注册表非空时须经 GatewayModelRoute，否则 createTask 500（同 aitryon 试衣问题）。
 */
const VISUAL = ["canvas", "story", "tool", "ecom"] as const;

function dashVideo(modelKey: string, sortOrder: number): CanonicalModelDef {
  return {
    canonicalModelKey: modelKey,
    displayName: modelKey,
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL],
    sortOrder,
    primaryVendor: "aliyun",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: [{ vendor: "aliyun", modelKey, providerKind: "DASHSCOPE" }],
  };
}

function bailianVideo(modelKey: string, sortOrder: number): CanonicalModelDef {
  return {
    canonicalModelKey: modelKey,
    displayName: modelKey,
    mediaKind: "VIDEO_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL],
    sortOrder,
    primaryVendor: "aliyun",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: [{ vendor: "aliyun", modelKey, providerKind: "BAILIAN" }],
  };
}

function kieImage(modelKey: string, sortOrder: number): CanonicalModelDef {
  return {
    canonicalModelKey: modelKey,
    displayName: modelKey,
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL],
    sortOrder,
    primaryVendor: "kie",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: [{ vendor: "kie", modelKey, providerKind: "KIE" }],
  };
}

function kieVideo(modelKey: string, sortOrder: number): CanonicalModelDef {
  return {
    canonicalModelKey: modelKey,
    displayName: modelKey,
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL],
    sortOrder,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: [{ vendor: "kie", modelKey, providerKind: "KIE" }],
  };
}

function kieV2v(modelKey: string, sortOrder: number): CanonicalModelDef {
  return {
    canonicalModelKey: modelKey,
    displayName: modelKey,
    mediaKind: "VIDEO_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL],
    sortOrder,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: [{ vendor: "kie", modelKey, providerKind: "KIE" }],
  };
}

function bailianChat(modelKey: string, sortOrder: number): CanonicalModelDef {
  return {
    canonicalModelKey: modelKey,
    displayName: modelKey,
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...VISUAL, "prompt-optimizer"],
    sortOrder,
    primaryVendor: "aliyun",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: [{ vendor: "aliyun", modelKey, providerKind: "BAILIAN" }],
  };
}

export const LEGACY_INVOKE_MODEL_REGISTRY: CanonicalModelDef[] = [
  {
    canonicalModelKey: "wanx2.1-t2i-plus",
    displayName: "万相文生图 Plus",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: ["tool"],
    sortOrder: 50,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: [{ vendor: "aliyun", modelKey: "wanx2.1-t2i-plus", providerKind: "DASHSCOPE" }],
  },
  {
    canonicalModelKey: "wanx2.1-t2i-turbo",
    displayName: "万相文生图 Turbo",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: ["tool", "ecom"],
    sortOrder: 51,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: [{ vendor: "aliyun", modelKey: "wanx2.1-t2i-turbo", providerKind: "DASHSCOPE" }],
  },
  {
    canonicalModelKey: "qwen3-tts-flash",
    displayName: "通义 TTS Flash",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "TTS",
    appTags: ["canvas", "story"],
    sortOrder: 52,
    primaryVendor: "aliyun",
    routes: [{ vendor: "aliyun", modelKey: "qwen3-tts-flash", providerKind: "BAILIAN" }],
  },
  {
    canonicalModelKey: "qwen3-tts",
    displayName: "通义 TTS",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "TTS",
    appTags: ["canvas", "story"],
    sortOrder: 53,
    primaryVendor: "aliyun",
    routes: [{ vendor: "aliyun", modelKey: "qwen3-tts", providerKind: "BAILIAN" }],
  },
  dashVideo("happyhorse-1.0-i2v", 54),
  dashVideo("happyhorse-1.0-t2v", 55),
  dashVideo("happyhorse-1.0-video-edit", 56),
  dashVideo("wan2.6-i2v", 57),
  dashVideo("wan2.6-t2v", 58),
  dashVideo("wan2.6-i2v-flash", 59),
  bailianVideo("wan2.6-r2v-flash", 60),
  dashVideo("wan2.7-i2v-2026-04-25", 61),
  dashVideo("wan2.7-t2v", 62),
  dashVideo("wan2.7-t2v-2026-04-25", 63),
  dashVideo("wan2.5-i2v-preview", 64),
  dashVideo("wan2.5-t2v-preview", 65),
  dashVideo("pixverse-c1-it2v", 66),
  dashVideo("pixverse-c1-t2v", 67),
  dashVideo("pixverse-v6-it2v", 68),
  dashVideo("pixverse-v6-t2v", 69),
  kieImage("flux-2-pro", 70),
  {
    canonicalModelKey: "gpt-image-1",
    displayName: "GPT Image 1.5 (KIE)",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL],
    sortOrder: 71,
    primaryVendor: "kie",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: [{ vendor: "kie", modelKey: "gpt-image-1", providerKind: "KIE" }],
  },
  {
    canonicalModelKey: "gpt-image-2",
    displayName: "GPT Image 2 (KIE)",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL],
    sortOrder: 72,
    primaryVendor: "kie",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: [
      { vendor: "kie", modelKey: "gpt-image-2", providerKind: "KIE" },
      { vendor: "kie", modelKey: "gpt-image-2-text-to-image", providerKind: "KIE" },
      { vendor: "kie", modelKey: "gpt-image-2-image-to-image", providerKind: "KIE" },
    ],
  },
  kieImage("seedream-4.5", 73),
  kieImage("seedream-5-lite", 74),
  kieImage("qwen-text-to-image", 75),
  {
    canonicalModelKey: "grok-imagine/text-to-image",
    displayName: "Grok Imagine · 文生图",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL],
    sortOrder: 87,
    primaryVendor: "kie",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: [{ vendor: "kie", modelKey: "grok-imagine/text-to-image", providerKind: "KIE" }],
  },
  {
    canonicalModelKey: "grok-imagine/image-to-video",
    displayName: "Grok Imagine · 图生视频",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL],
    sortOrder: 88,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: [{ vendor: "kie", modelKey: "grok-imagine/image-to-video", providerKind: "KIE" }],
  },
  {
    canonicalModelKey: "grok-imagine-video-1-5-preview",
    displayName: "Grok Imagine Video 1.5",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL],
    sortOrder: 89,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: [
      { vendor: "kie", modelKey: "grok-imagine-video-1-5-preview", providerKind: "KIE" },
    ],
  },
  kieV2v("wan/2-6-video-to-video", 90),
  kieV2v("kling-2.6/motion-control", 91),
  kieV2v("kling-3.0/motion-control", 92),
  {
    canonicalModelKey: "topaz/video-upscale",
    displayName: "Topaz Video Upscale (KIE)",
    mediaKind: "VIDEO_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL],
    sortOrder: 93,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/次",
    routes: [{ vendor: "kie", modelKey: "topaz/video-upscale", providerKind: "KIE" }],
  },
  kieVideo("veo-2", 76),
  bailianChat("qwen-vl-max", 77),
  bailianChat("qwen-vl-plus", 78),
  bailianChat("qwen3-vl-plus", 79),
  bailianChat("qwen3-vl-flash", 80),
  bailianChat("qwen3.5-plus", 81),
  bailianChat("qwen3.5-27b", 82),
  bailianChat("qwen3.6-plus", 83),
  bailianChat("qwen3.6-flash", 84),
  {
    canonicalModelKey: "hunyuan-3d-express",
    displayName: "混元 3D Express",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: ["canvas"],
    sortOrder: 85,
    primaryVendor: "tencent",
    routes: [{ vendor: "tencent", modelKey: "hunyuan-3d-express", providerKind: "HUNYUAN" }],
  },
  {
    canonicalModelKey: "hy-3d-express",
    displayName: "混元 3D Express（别名）",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: ["canvas"],
    sortOrder: 86,
    primaryVendor: "tencent",
    routes: [{ vendor: "tencent", modelKey: "hy-3d-express", providerKind: "HUNYUAN" }],
  },
  ...MINIMAX_SPEECH_MODELS.map((m, i) => ({
    canonicalModelKey: m.modelKey,
    displayName: m.label,
    description: m.subtitle,
    mediaKind: "TEXT_LLM" as const,
    role: "LLM" as const,
    requestKind: "TTS" as const,
    appTags: ["tool", "canvas", "story"],
    sortOrder: 100 + i,
    primaryVendor: "minimax",
    billingKind: "PER_CALL" as const,
    unitLabel: "元/次",
    routes: [{ vendor: "minimax", modelKey: m.modelKey, providerKind: "MINIMAX" as const }],
  })),
  ...MINIMAX_MUSIC_MODELS.map((m, i) => ({
    canonicalModelKey: m.modelKey,
    displayName: m.label,
    description: m.subtitle,
    mediaKind: "TEXT_LLM" as const,
    role: "LLM" as const,
    requestKind: "MUSIC" as const,
    appTags: ["tool"],
    sortOrder: 110 + i,
    primaryVendor: "minimax",
    billingKind: "PER_CALL" as const,
    unitLabel: "元/次",
    routes: [{ vendor: "minimax", modelKey: m.modelKey, providerKind: "MINIMAX" as const }],
  })),
];
