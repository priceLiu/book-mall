import type { GatewayProviderKind } from "@prisma/client";

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

export function routeGatewayModel(model: string): RoutedModel {
  const m = model.trim().toLowerCase();

  if (HUNYUAN_MODELS.has(m) || m.startsWith("hunyuan-3d")) {
    return { providerKind: "HUNYUAN", requestKind: "IMAGE" };
  }

  if (TTS_MODELS.has(m) || m.startsWith("tts-")) {
    return { providerKind: "BAILIAN", requestKind: "TTS" };
  }

  if (TRYON_PREFIXES.some((p) => m.startsWith(p))) {
    return { providerKind: "DASHSCOPE", requestKind: "TRYON" };
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
    const isVideo =
      m.includes("video") ||
      m.includes("seedance") ||
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

  return { providerKind: "KIE", requestKind: "OTHER" };
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
    case "KIE":
    default:
      return (
        process.env.KIE_API_BASE?.trim()?.replace(/\/$/, "") ||
        "https://api.kie.ai"
      );
  }
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

export {
  assertStoryModelCapabilities,
  getStoryModelCapabilities,
  modelHasStoryCapabilities,
  type StoryModelCapability,
} from "@/lib/canvas/story-model-capabilities";
