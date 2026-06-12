import type { GatewayProviderKind } from "@prisma/client";

import {
  VOLCENGINE_CHAT_MODEL_KEYS,
  VOLCENGINE_VIDEO_MODEL_KEYS,
  resolveVolcengineModelKey,
} from "@/lib/gateway/volcengine-chat-models";

export { resolveVolcengineModelKey };

const DEEPSEEK_MODELS = new Set([
  "deepseek-chat",
  "deepseek-reasoner",
  "deepseek-coder",
]);

const KIE_CHAT_MODELS = new Set([
  "gemini-3-flash",
  "google/gemini-3-flash",
  "google/gemini-3-flash-preview",
  "gemini-2.5-flash",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-preview",
]);

const KIE_JOB_PREFIXES = [
  "bytedance/",
  "google/",
  "wan/",
  "seedance",
  "nano-banana",
  "flux",
  "kling",
  "veo",
];

const BAILIAN_R2V = new Set([
  "happyhorse-1.0-r2v",
  "wan2.6-r2v",
  "wan2.6-r2v-flash",
  "wan2.7-r2v",
]);

const TTS_MODELS = new Set(["tts-1", "tts-1-hd", "qwen3-tts"]);

const TRYON_PREFIXES = ["aitryon"];

const HUNYUAN_MODELS = new Set(["hunyuan-3d-pro", "hunyuan-3d-express"]);

const DASHSCOPE_VIDEO_PREFIXES = [
  "happyhorse-1.0-",
  "happyhorse-1-0-",
  "wan2.",
  "pixverse-",
];

export type RoutedModel = {
  providerKind: GatewayProviderKind;
  requestKind: "CHAT" | "IMAGE" | "VIDEO" | "OTHER" | "TTS" | "TRYON";
};

/** 未在模型目录登记的 modelKey；禁止默认落 KIE。 */
export class UnknownGatewayModelError extends Error {
  constructor(public readonly modelKey: string) {
    super(`未知 Gateway 模型: ${modelKey}`);
    this.name = "UnknownGatewayModelError";
  }
}

export function routeGatewayModel(model: string): RoutedModel {
  const raw = model.trim();
  const m = raw.toLowerCase();

  if (m.startsWith("ep-")) {
    return { providerKind: "VOLCENGINE", requestKind: "VIDEO" };
  }

  if (HUNYUAN_MODELS.has(m) || m.startsWith("hunyuan-3d")) {
    return { providerKind: "HUNYUAN", requestKind: "IMAGE" };
  }

  if (TTS_MODELS.has(m) || m.startsWith("tts-")) {
    return { providerKind: "BAILIAN", requestKind: "TTS" };
  }

  if (TRYON_PREFIXES.some((p) => m.startsWith(p))) {
    return { providerKind: "DASHSCOPE", requestKind: "TRYON" };
  }

  if (m.startsWith("wan2.7-image") || m.startsWith("wan2.7_image")) {
    return { providerKind: "DASHSCOPE", requestKind: "IMAGE" };
  }

  if (m === "wan2.6-t2i" || m === "wan2.6-image" || m.includes("wan2.6-image")) {
    return { providerKind: "DASHSCOPE", requestKind: "IMAGE" };
  }

  if (
    m.startsWith("kling/kling-v3") ||
    m === "kling-3.0-image" ||
    m.includes("kling-v3-omni-image") ||
    m.includes("kling-v3-image-generation")
  ) {
    return { providerKind: "DASHSCOPE", requestKind: "IMAGE" };
  }

  if (m.startsWith("wanx") || m.includes("wanx")) {
    return { providerKind: "DASHSCOPE", requestKind: "IMAGE" };
  }

  if (
    DASHSCOPE_VIDEO_PREFIXES.some((p) => m.startsWith(p)) ||
    (m.includes("-i2v") && !m.includes("/")) ||
    (m.includes("-t2v") && !m.includes("/")) ||
    (m.includes("-r2v") && !BAILIAN_R2V.has(m))
  ) {
    return { providerKind: "DASHSCOPE", requestKind: "VIDEO" };
  }

  if (BAILIAN_R2V.has(m)) {
    return { providerKind: "BAILIAN", requestKind: "VIDEO" };
  }

  if (DEEPSEEK_MODELS.has(m) || m.startsWith("deepseek")) {
    return { providerKind: "DEEPSEEK", requestKind: "CHAT" };
  }

  if (
    VOLCENGINE_VIDEO_MODEL_KEYS.has(m) ||
    m.includes("doubao-seedance") ||
    (m.includes("seedance") && m.includes("doubao"))
  ) {
    return { providerKind: "VOLCENGINE", requestKind: "VIDEO" };
  }

  if (
    VOLCENGINE_CHAT_MODEL_KEYS.has(m) ||
    m.startsWith("doubao-seed-2") ||
    m.startsWith("doubao-lite") ||
    (m.startsWith("doubao") &&
      !m.includes("seedream") &&
      !m.includes("seedance") &&
      !m.includes("bytedance/"))
  ) {
    return { providerKind: "VOLCENGINE", requestKind: "CHAT" };
  }

  if (
    m.startsWith("seedream-") ||
    m.startsWith("gpt-image-") ||
    m.startsWith("flux-") ||
    m === "qwen-text-to-image"
  ) {
    return { providerKind: "KIE", requestKind: "IMAGE" };
  }

  if (m.startsWith("happyhorse/")) {
    return { providerKind: "KIE", requestKind: "VIDEO" };
  }

  if (KIE_CHAT_MODELS.has(m)) {
    return { providerKind: "KIE", requestKind: "CHAT" };
  }

  if (
    /^gemini-\d+\.\d-flash(-preview)?$/i.test(m) ||
    /^google\/gemini-\d+\.\d-flash(-preview)?$/i.test(m)
  ) {
    return { providerKind: "KIE", requestKind: "CHAT" };
  }

  if (KIE_JOB_PREFIXES.some((p) => m.includes(p))) {
    if (m.includes("doubao") && m.includes("seedance")) {
      return { providerKind: "VOLCENGINE", requestKind: "VIDEO" };
    }
    const isVideo =
      m.includes("video") ||
      (m.includes("seedance") && !m.includes("doubao")) ||
      m.includes("wan") ||
      m.includes("kling") ||
      m.includes("veo");
    return {
      providerKind: "KIE",
      requestKind: isVideo ? "VIDEO" : "IMAGE",
    };
  }

  if (m.includes("qwen") || m.includes("bailian") || m.includes("minimax")) {
    return { providerKind: "BAILIAN", requestKind: "CHAT" };
  }

  throw new UnknownGatewayModelError(raw || model);
}

/** OpenAI 兼容 Chat/TTS 的 DashScope 根地址（勿与 api/v1 异步任务根混用） */
export function defaultBaseUrl(kind: GatewayProviderKind): string {
  switch (kind) {
    case "DEEPSEEK":
      return "https://api.deepseek.com/v1";
    case "BAILIAN":
    case "DASHSCOPE":
      return "https://dashscope.aliyuncs.com/compatible-mode/v1";
    case "HUNYUAN":
      return "https://api.ai3d.cloud.tencent.com";
    case "VOLCENGINE":
      return "https://ark.cn-beijing.volces.com/api/v3";
    default:
      return (
        process.env.KIE_API_BASE?.trim()?.replace(/\/$/, "") ||
        "https://api.kie.ai"
      );
  }
}

const VOLCENGINE_ARK_HOST_RE =
  /^https?:\/\/ark\.[a-z0-9.-]+\.volces\.com$/i;

/**
 * 火山方舟 OpenAPI 根（…/api/v3），供视频 tasks / 人像 Action API 等使用。
 * 凭证 baseUrl 若误填 chat/completions 完整路径，在此剥 suffix。
 */
export function resolveVolcengineArkApiRoot(
  baseUrl?: string | null,
): string {
  const fallback = defaultBaseUrl("VOLCENGINE").replace(/\/$/, "");
  let raw = (baseUrl?.trim() || fallback).replace(/\/$/, "");
  if (!raw) return fallback;

  raw = raw.replace(/\/chat\/completions$/i, "");
  raw = raw.replace(/\/bots$/i, "");
  raw = raw.replace(/\/contents\/generations\/tasks$/i, "");

  if (VOLCENGINE_ARK_HOST_RE.test(raw)) {
    return `${raw}/api/v3`;
  }
  return raw;
}

const DASHSCOPE_HOST_RE = /^https?:\/\/dashscope\.aliyuncs\.com\/?$/i;
const DEEPSEEK_HOST_RE = /^https?:\/\/api\.deepseek\.com\/?$/i;

/** DeepSeek OpenAI 兼容端点须带 /v1，避免裸域名路径不一致。 */
export function resolveDeepSeekBaseUrl(
  baseUrl: string | null | undefined,
): string {
  const fallback = defaultBaseUrl("DEEPSEEK").replace(/\/$/, "");
  const raw = (baseUrl?.trim() || fallback).replace(/\/$/, "");
  if (!raw) return fallback;
  if (DEEPSEEK_HOST_RE.test(raw)) return `${raw}/v1`;
  if (/api\.deepseek\.com/i.test(raw) && !/\/v\d+$/i.test(raw)) {
    return `${raw}/v1`;
  }
  return raw;
}

/**
 * 将用户填写的 DashScope 根域名规范为 compatible-mode/v1，避免请求 /chat/completions 404。
 */
export function resolveOpenAiCompatibleBaseUrl(
  kind: GatewayProviderKind,
  baseUrl: string | null | undefined,
): string {
  const fallback = defaultBaseUrl(
    kind === "DASHSCOPE" ? "BAILIAN" : kind,
  ).replace(/\/$/, "");

  if (kind === "VOLCENGINE") {
    return (baseUrl?.trim() || fallback).replace(/\/$/, "");
  }

  if (kind !== "BAILIAN" && kind !== "DASHSCOPE") {
    return (baseUrl?.trim() || fallback).replace(/\/$/, "");
  }

  const raw = (baseUrl?.trim() || fallback).replace(/\/$/, "");
  if (!raw) return fallback;

  if (/\/compatible-mode\/v\d+$/i.test(raw)) return raw;
  if (/\/compatible-mode$/i.test(raw)) return `${raw}/v1`;
  if (DASHSCOPE_HOST_RE.test(raw)) return `${raw}/compatible-mode/v1`;

  return raw;
}

/** KIE Gemini Chat 端点路径段（OpenAI 兼容 /{segment}/v1/chat/completions） */
export function resolveKieGeminiChatPath(modelKey: string): string {
  const m = modelKey.trim().toLowerCase();
  if (m.includes("2.5") && m.includes("flash")) {
    return "gemini-2.5-flash";
  }
  return "gemini-3-flash";
}

/** 百炼 compatible-mode 上游 model 字段（MiniMax 官方 ID 带 MiniMax/ 前缀） */
export function resolveBailianChatModelKey(modelKey: string): string {
  const raw = modelKey.trim();
  const aliases: Record<string, string> = {
    "MiniMax-M2.7": "MiniMax/MiniMax-M2.7",
  };
  return aliases[raw] ?? raw;
}

/** DeepSeek 上游 model 字段（legacy deepseek-chat 等 → V4 Flash） */
export function resolveDeepseekChatModelKey(modelKey: string): string {
  const raw = modelKey.trim();
  const m = raw.toLowerCase();
  if (m === "deepseek-v4-flash" || m === "deepseek-v4-pro") return raw;
  if (
    m === "deepseek-chat" ||
    m === "deepseek-reasoner" ||
    m === "deepseek-coder"
  ) {
    return "deepseek-v4-flash";
  }
  return raw;
}

export {
  assertStoryModelCapabilities,
  getStoryModelCapabilities,
  modelHasStoryCapabilities,
  type StoryModelCapability,
} from "@/lib/canvas/story-model-capabilities";
