import type {
  CanvasModelRole,
  GatewayProviderKind,
  GatewayRequestKind,
  ModelMediaKind,
} from "@prisma/client";

export type CanonicalRouteDef = {
  vendor: string;
  modelKey: string;
  providerKind: GatewayProviderKind;
};

export type CanonicalModelDef = {
  canonicalModelKey: string;
  displayName: string;
  description?: string;
  mediaKind: ModelMediaKind;
  role: CanvasModelRole;
  requestKind: GatewayRequestKind;
  /** 适用应用 tag：canvas / story / tool / ecom / prompt-optimizer */
  appTags: string[];
  sortOrder: number;
  routes: CanonicalRouteDef[];
  /** 主 vendor（ModelCatalog.vendor 展示用） */
  primaryVendor: string;
  billingKind?: "PER_IMAGE" | "PER_SECOND" | "PER_1K_TOKENS" | "PER_CALL";
  unitLabel?: string;
};

export const PLATFORM_MEDIA_KIND_LABEL: Record<ModelMediaKind, string> = {
  TEXT_TO_IMAGE: "文生图",
  IMAGE_TO_VIDEO: "图生视频",
  VIDEO_TO_VIDEO: "视频生视频",
  TEXT_LLM: "纯文本",
};

const ALL_APPS = ["canvas", "story", "tool", "ecom", "prompt-optimizer"] as const;
const CHAT_APPS = ["canvas", "story", "tool", "ecom", "prompt-optimizer"] as const;
const VISUAL_APPS = ["canvas", "story", "tool", "ecom"] as const;

function dedupeRoutes(list: CanonicalRouteDef[]): CanonicalRouteDef[] {
  const seen = new Set<string>();
  const out: CanonicalRouteDef[] = [];
  for (const r of list) {
    const k = `${r.vendor}:${r.modelKey}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

import { LEGACY_INVOKE_MODEL_REGISTRY } from "@/lib/platform-model/legacy-invoke-registry";

/** Gateway 统一 canonical 注册表（seed + 自动上架数据源）。 */
const CORE_GATEWAY_CANONICAL_REGISTRY: CanonicalModelDef[] = [
  {
    canonicalModelKey: "deepseek-chat",
    displayName: "DeepSeek 快速对话",
    description: "对话 / 助手 / 文案",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 10,
    primaryVendor: "deepseek",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "deepseek", modelKey: "deepseek-v4-flash", providerKind: "DEEPSEEK" },
    ]),
  },
  {
    canonicalModelKey: "qwen-turbo",
    displayName: "通义 Qwen 快速对话",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 11,
    primaryVendor: "aliyun",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "qwen3.5-flash", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "gemini-flash",
    displayName: "Gemini 快速对话",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 12,
    primaryVendor: "kie",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "gemini-2.5-flash", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "wan2.7-image",
    displayName: "通义万相 2.7 生图",
    description: "多图参考生图",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 20,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "wan2.7-image", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "wan2.7-image-pro",
    displayName: "通义万相 2.7 Pro 生图",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 21,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "wan2.7-image-pro", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "kling-3.0-image",
    displayName: "可灵 3.0 生图",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 22,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "kling-3.0-image", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "lib-nano-pro",
    displayName: "Nano Banana Pro (KIE)",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 23,
    primaryVendor: "kie",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "nano-banana-pro", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "aitryon",
    displayName: "AI 试衣-基础版",
    description: "百炼 aitryon 虚拟试衣成片",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "TRYON",
    appTags: ["tool", ...VISUAL_APPS],
    sortOrder: 21,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "aitryon", providerKind: "DASHSCOPE" },
    ]),
  },
  {
    canonicalModelKey: "aitryon-plus",
    displayName: "AI 试衣-Plus 版",
    description: "百炼 aitryon-plus 虚拟试衣成片",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "TRYON",
    appTags: ["tool", ...VISUAL_APPS],
    sortOrder: 22,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "aitryon-plus", providerKind: "DASHSCOPE" },
    ]),
  },
  {
    canonicalModelKey: "aitryon-parsing-v1",
    displayName: "AI 试衣-图片分割",
    description: "全身图上下装分割（角色资产服装槽 / 试衣预处理）",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "TRYON",
    appTags: [...VISUAL_APPS],
    sortOrder: 24,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张（输入）",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "aitryon-parsing-v1", providerKind: "DASHSCOPE" },
    ]),
  },
  {
    canonicalModelKey: "aitryon-refiner",
    displayName: "AI 试衣-图片精修",
    description: "百炼 aitryon-refiner 试衣精修（阶梯价）",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "TRYON",
    appTags: ["tool", ...VISUAL_APPS],
    sortOrder: 25,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "aitryon-refiner", providerKind: "DASHSCOPE" },
    ]),
  },
  {
    canonicalModelKey: "seedance-2.0",
    displayName: "Seedance 2.0 图生视频",
    description: "图生视频 / 分镜成片",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 30,
    primaryVendor: "volcengine",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "volcengine", modelKey: "doubao-seedance-2.0", providerKind: "VOLCENGINE" },
      { vendor: "kie", modelKey: "bytedance/seedance-2", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "kling-3.0-video",
    displayName: "可灵 3.0 视频",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 31,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "kling-3.0/video", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "wanxiang-video-2.7-i2v",
    displayName: "万相 2.7 图生视频",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 32,
    primaryVendor: "aliyun",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "wan2.7-i2v", providerKind: "DASHSCOPE" },
    ]),
  },
  {
    canonicalModelKey: "happyhorse-r2v",
    displayName: "HappyHorse 参考生视频",
    mediaKind: "VIDEO_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 40,
    primaryVendor: "aliyun",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "happyhorse-1.0-r2v", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "wanxiang-video-2.6",
    displayName: "万相 2.6 参考生视频",
    mediaKind: "VIDEO_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 41,
    primaryVendor: "aliyun",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "wan2.6-r2v", providerKind: "DASHSCOPE" },
    ]),
  },
  {
    canonicalModelKey: "wanxiang-video-2.7",
    displayName: "万相 2.7 参考生视频",
    mediaKind: "VIDEO_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 42,
    primaryVendor: "aliyun",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "wan2.7-r2v", providerKind: "DASHSCOPE" },
    ]),
  },
];

export const GATEWAY_CANONICAL_REGISTRY: CanonicalModelDef[] = [
  ...CORE_GATEWAY_CANONICAL_REGISTRY,
  ...LEGACY_INVOKE_MODEL_REGISTRY,
];

/** 四媒介槽默认 canonical（无用户选模时 fallback）。 */
export const PLATFORM_MEDIA_DEFAULTS: Record<ModelMediaKind, string> = {
  TEXT_LLM: "qwen-turbo",
  TEXT_TO_IMAGE: "wan2.7-image",
  IMAGE_TO_VIDEO: "seedance-2.0",
  VIDEO_TO_VIDEO: "happyhorse-r2v",
};

export function canonicalByKey(key: string): CanonicalModelDef | undefined {
  return GATEWAY_CANONICAL_REGISTRY.find((c) => c.canonicalModelKey === key);
}

export function canonicalsForAppTag(appTag: string): CanonicalModelDef[] {
  const tag = appTag.trim().toLowerCase();
  return GATEWAY_CANONICAL_REGISTRY.filter((c) =>
    c.appTags.some((t) => t.toLowerCase() === tag),
  ).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** @deprecated 使用 canonicalModelKey；保留别名供旧 import 过渡 */
export type PlatformMediaKind = ModelMediaKind;
