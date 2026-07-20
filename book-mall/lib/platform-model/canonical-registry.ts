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
    displayName: "DeepSeek Chat Flash",
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
      { vendor: "deepseek", modelKey: "deepseek-v4-pro", providerKind: "DEEPSEEK" },
      { vendor: "deepseek", modelKey: "deepseek-chat", providerKind: "DEEPSEEK" },
    ]),
  },
  {
    canonicalModelKey: "kimi-k3",
    displayName: "Kimi K3",
    description: "旗舰 · 1M 上下文 · 剧本 / 长文",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 12,
    primaryVendor: "moonshot",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "moonshot", modelKey: "kimi-k3", providerKind: "MOONSHOT" },
    ]),
  },
  {
    canonicalModelKey: "kimi-k2.6",
    displayName: "Kimi K2.6",
    description: "256K · 可选深度思考 · 剧本创作",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 13,
    primaryVendor: "moonshot",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "moonshot", modelKey: "kimi-k2.6", providerKind: "MOONSHOT" },
    ]),
  },
  {
    canonicalModelKey: "kimi-k2.7-code",
    displayName: "Kimi K2.7 Code",
    description: "256K · 结构化剧本 / 代码",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 14,
    primaryVendor: "moonshot",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "moonshot", modelKey: "kimi-k2.7-code", providerKind: "MOONSHOT" },
    ]),
  },
  {
    canonicalModelKey: "qwen-turbo",
    displayName: "Qwen Turbo Flash",
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
    displayName: "Gemini Flash Chat",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 12,
    primaryVendor: "kie",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "google/gemini-3-flash-preview", providerKind: "KIE" },
      { vendor: "kie", modelKey: "gemini-3-flash", providerKind: "KIE" },
      { vendor: "kie", modelKey: "gemini-2.5-flash", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "gpt-5-5-chat",
    displayName: "GPT-5.5 Chat",
    description: "OpenAI GPT-5.5 · 复杂推理 / 剧本脚本",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 13,
    primaryVendor: "kie",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "gpt-5-5", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "doubao-seed-2.1-pro",
    displayName: "Doubao Seed 2.1 Pro Vision",
    description:
      "火山方舟 · 多模态图片理解 · 画布文本节点反推提示词（上游 doubao-seed-2-1-pro-260628）",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 14,
    primaryVendor: "volcengine",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "volcengine", modelKey: "doubao-seed-2.1-pro", providerKind: "VOLCENGINE" },
    ]),
  },
  {
    canonicalModelKey: "doubao-seed-2.0",
    displayName: "Doubao Seed 2.0 Pro Vision",
    description:
      "火山方舟 · 多模态图片理解 · 画布文本节点反推提示词（上游 doubao-seed-2-1-pro-260628）",
    mediaKind: "TEXT_LLM",
    role: "LLM",
    requestKind: "CHAT",
    appTags: [...CHAT_APPS],
    sortOrder: 14,
    primaryVendor: "volcengine",
    billingKind: "PER_1K_TOKENS",
    unitLabel: "元/百万 tokens",
    routes: dedupeRoutes([
      { vendor: "volcengine", modelKey: "doubao-seed-2.0", providerKind: "VOLCENGINE" },
    ]),
  },
  {
    canonicalModelKey: "wan2.7-image",
    displayName: "Wan 2.7 Image",
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
    displayName: "Wan 2.7 Image Pro",
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
    displayName: "Kling 3.0 Image",
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
    displayName: "AI Try-On Basic",
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
    displayName: "AI Try-On Plus",
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
    displayName: "AI Try-On Parsing",
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
    displayName: "AI Try-On Refiner",
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
    displayName: "Seedance 2.0 I2V",
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
    ]),
  },
  {
    canonicalModelKey: "kling-3.0-video",
    displayName: "Kling 3.0 I2V/T2V",
    description: "KIE · 可灵 3.0 · 图生/文生视频，多镜头 + 元素引用。",
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
    canonicalModelKey: "kling-3.0-turbo-i2v",
    displayName: "Kling 3.0 Turbo I2V",
    description: "KIE · 可灵 3.0 Turbo · 首帧图生视频，速度优先。",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 311,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "kling/v3-turbo-image-to-video", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "kling-3.0-turbo-t2v",
    displayName: "Kling 3.0 Turbo T2V",
    description: "KIE · 可灵 3.0 Turbo · 纯文生视频，速度优先。",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 312,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "kling/v3-turbo-text-to-video", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "kling-3.0-motion-control",
    displayName: "Kling 3.0 Motion Control",
    description: "KIE · 可灵 3.0 Motion Control · 参考图 + 动作视频驱动角色。",
    mediaKind: "VIDEO_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 313,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "kling-3.0/motion-control", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "kling-2.6-motion-control",
    displayName: "Kling 2.6 Motion Control",
    description: "KIE · 可灵 2.6 Motion Control · 参考图 + 动作视频驱动角色。",
    mediaKind: "VIDEO_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 314,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "kling-2.6/motion-control", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "kling-ai-avatar-standard",
    displayName: "Kling AI Avatar Standard",
    description: "KIE · 可灵 AI Avatar · 头像图 + 音频生成口型同步数字人视频。",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 315,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "kling/ai-avatar-standard", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "kling-ai-avatar-pro",
    displayName: "Kling AI Avatar Pro",
    description: "KIE · 可灵 AI Avatar Pro · 头像图 + 音频生成高质量口型同步数字人视频。",
    mediaKind: "IMAGE_TO_VIDEO",
    role: "VIDEO",
    requestKind: "VIDEO",
    appTags: [...VISUAL_APPS],
    sortOrder: 316,
    primaryVendor: "kie",
    billingKind: "PER_SECOND",
    unitLabel: "元/秒",
    routes: dedupeRoutes([
      { vendor: "kie", modelKey: "kling/ai-avatar-pro", providerKind: "KIE" },
    ]),
  },
  {
    canonicalModelKey: "wanxiang-video-2.7-i2v",
    displayName: "Wan 2.7 I2V",
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
    displayName: "HappyHorse R2V",
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
      { vendor: "aliyun", modelKey: "happyhorse-1.1-r2v", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "wanxiang-video-2.6",
    displayName: "Wan 2.6 R2V",
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
    displayName: "Wan 2.7 R2V",
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
  {
    canonicalModelKey: "qwen-image-edit",
    displayName: "Qwen Image Edit",
    description: "百炼 · 局部修图 / 多图融合（qwen-image-edit）",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 35,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "qwen-image-edit", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "qwen-image-edit-max",
    displayName: "Qwen Image Edit Max",
    description: "百炼 · 增强工业设计与几何推理（qwen-image-edit-max）",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 36,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "qwen-image-edit-max", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "doubao-seedream-5-0-lite",
    displayName: "Doubao Seedream 5.0 Lite",
    description: "火山方舟 · 指令式图像编辑（doubao-seedream-5-0-260128）",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 37,
    primaryVendor: "volcengine",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      {
        vendor: "volcengine",
        modelKey: "doubao-seedream-5-0-260128",
        providerKind: "VOLCENGINE",
      },
    ]),
  },
  {
    canonicalModelKey: "image-out-painting",
    displayName: "Bailian Out-Painting",
    description: "阿里百炼 image-out-painting · 等比/定向/旋转扩图",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 38,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "image-out-painting", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "wanx-x-painting",
    displayName: "Wanx Local Inpaint",
    description: "百炼 wanx-x-painting · 涂抹区域局部重绘",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 39,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "wanx-x-painting", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "wan2.5-i2i-preview",
    displayName: "Wan 2.5 Image Edit",
    description: "百炼 wan2.5-i2i-preview · 单图/多图融合编辑",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "IMAGE",
    appTags: [...VISUAL_APPS],
    sortOrder: 40,
    primaryVendor: "aliyun",
    billingKind: "PER_IMAGE",
    unitLabel: "元/张",
    routes: dedupeRoutes([
      { vendor: "aliyun", modelKey: "wan2.5-i2i-preview", providerKind: "BAILIAN" },
    ]),
  },
  {
    canonicalModelKey: "portrait-virtual",
    displayName: "Virtual Portrait Library",
    description: "火山方舟 Assets API · 虚拟人像入库 asset://",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "OTHER",
    appTags: ["canvas", "story"],
    sortOrder: 90,
    primaryVendor: "volcengine",
    billingKind: "PER_CALL",
    unitLabel: "元/次",
    routes: dedupeRoutes([
      { vendor: "volcengine", modelKey: "portrait:virtual", providerKind: "VOLCENGINE" },
    ]),
  },
  {
    canonicalModelKey: "portrait-real",
    displayName: "Real Portrait Library",
    description: "火山方舟 Assets API · H5 活体 + 真人 CreateAsset",
    mediaKind: "TEXT_TO_IMAGE",
    role: "IMAGE",
    requestKind: "OTHER",
    appTags: ["canvas", "story"],
    sortOrder: 91,
    primaryVendor: "volcengine",
    billingKind: "PER_CALL",
    unitLabel: "元/次",
    routes: dedupeRoutes([
      { vendor: "volcengine", modelKey: "portrait:real", providerKind: "VOLCENGINE" },
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
