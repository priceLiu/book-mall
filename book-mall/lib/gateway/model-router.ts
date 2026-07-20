import type { GatewayProviderKind } from "@prisma/client";

import {
  isMinimaxMusicModelKey,
  isMinimaxSpeechModelKey,
} from "@/lib/gateway/minimax-speech-models";
import {
  isKieElevenLabsMarketModelKey,
  isKieSunoModelKey,
} from "@/lib/gateway/kie-audio-models";
import {
  isElevenLabsSfxModelKey,
  isElevenLabsStsModelKey,
  isElevenLabsMusicModelKey,
} from "@/lib/gateway/elevenlabs-models";
import { isWorldlabsMarbleModelKey } from "@/lib/gateway/worldlabs-marble-models";
import { isTopazLabsVideoModelKey } from "@/lib/gateway/topaz-models";

import {
  VOLCENGINE_CHAT_MODEL_KEYS,
  VOLCENGINE_VIDEO_MODEL_KEYS,
  resolveVolcengineModelKey,
} from "@/lib/gateway/volcengine-chat-models";

export { resolveVolcengineModelKey };

const DEEPSEEK_MODELS = new Set([
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "deepseek-reasoner",
  "deepseek-coder",
]);

const MOONSHOT_MODELS = new Set([
  "kimi-k3",
  "kimi-k2.6",
  "kimi-k2.5",
  "kimi-k2.7-code",
  "kimi-k2.7-code-highspeed",
  "moonshot-v1-8k",
  "moonshot-v1-32k",
  "moonshot-v1-128k",
]);

const KIE_CHAT_MODELS = new Set([
  "gemini-3-flash",
  "google/gemini-3-flash",
  "google/gemini-3-flash-preview",
  "gemini-2.5-flash",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-preview",
  "gemini-3-5-flash",
  "gemini-3-pro",
  "claude-opus-4-8",
  "claude-opus-4-5",
  "gpt-5-5",
  "gpt-5.5",
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
  "grok-imagine",
  "topaz/",
  "motion-control",
];

const BAILIAN_R2V = new Set([
  "happyhorse-1.0-r2v",
  "happyhorse-1.1-r2v",
  "wan2.6-r2v",
  "wan2.6-r2v-flash",
  "wan2.7-r2v",
]);

/** createTask / 日志 Params · 百炼 R2V modelKey 白名单（与 routeGatewayModel 一致） */
export function isBailianR2vGatewayModel(model: string): boolean {
  return BAILIAN_R2V.has(model.trim().toLowerCase());
}

const TTS_MODELS = new Set(["tts-1", "tts-1-hd", "qwen3-tts"]);

const TRYON_PREFIXES = ["aitryon"];

const HUNYUAN_MODELS = new Set(["hunyuan-3d-pro", "hunyuan-3d-express"]);

const DASHSCOPE_VIDEO_PREFIXES = [
  "happyhorse-1.0-",
  "happyhorse-1.1-",
  "happyhorse-1-0-",
  "wan2.",
  "pixverse-",
];

export type RoutedModel = {
  providerKind: GatewayProviderKind;
  requestKind: "CHAT" | "IMAGE" | "VIDEO" | "OTHER" | "TTS" | "TRYON" | "MUSIC";
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

  if (m === "portrait:virtual" || m === "portrait:real") {
    return { providerKind: "VOLCENGINE", requestKind: "OTHER" };
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

  if (m.startsWith("happyhorse-1-1/")) {
    return { providerKind: "KIE", requestKind: "VIDEO" };
  }

  // 百炼 R2V（happyhorse / wan2.*-r2v）须在 DASHSCOPE 视频前缀之前：否则 happyhorse-1.0-r2v
  // 会误落 DASHSCOPE，createTask 忽略 body.bailian → 厂商报 input.prompt / input.media 缺失。
  if (BAILIAN_R2V.has(m)) {
    return { providerKind: "BAILIAN", requestKind: "VIDEO" };
  }

  if (
    DASHSCOPE_VIDEO_PREFIXES.some((p) => m.startsWith(p)) ||
    (m.includes("-i2v") && !m.includes("/")) ||
    (m.includes("-t2v") && !m.includes("/")) ||
    (m.includes("-r2v") && !BAILIAN_R2V.has(m))
  ) {
    return { providerKind: "DASHSCOPE", requestKind: "VIDEO" };
  }

  if (DEEPSEEK_MODELS.has(m) || m.startsWith("deepseek")) {
    return { providerKind: "DEEPSEEK", requestKind: "CHAT" };
  }

  if (
    MOONSHOT_MODELS.has(m) ||
    m.startsWith("kimi-") ||
    m.startsWith("moonshot-")
  ) {
    return { providerKind: "MOONSHOT", requestKind: "CHAT" };
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
    m === "lib-nano-pro" ||
    m.startsWith("nano-banana")
  ) {
    return { providerKind: "KIE", requestKind: "IMAGE" };
  }

  if (
    m === "qwen-image-edit" ||
    m === "qwen-image-edit-max" ||
    m.startsWith("qwen-image-edit")
  ) {
    return { providerKind: "BAILIAN", requestKind: "IMAGE" };
  }

  if (
    m === "image-out-painting" ||
    m === "wanx-x-painting" ||
    m === "wan2.5-i2i-preview"
  ) {
    return { providerKind: "BAILIAN", requestKind: "IMAGE" };
  }

  if (
    m === "doubao-seedream-5-0-lite" ||
    m === "doubao-seedream-5-0-260128" ||
    (m.includes("doubao-seedream-5") && m.includes("lite"))
  ) {
    return { providerKind: "VOLCENGINE", requestKind: "IMAGE" };
  }

  if (
    m.startsWith("seedream-") ||
    m.startsWith("gpt-image-") ||
    m.startsWith("flux-") ||
    m === "qwen-text-to-image" ||
    m === "google/nano-banana" ||
    m === "google/nano-banana-edit" ||
    m === "nano-banana-2" ||
    m === "4o-image"
  ) {
    return { providerKind: "KIE", requestKind: "IMAGE" };
  }

  if (m.startsWith("claude-opus") || m.startsWith("claude-sonnet")) {
    return { providerKind: "KIE", requestKind: "CHAT" };
  }

  if (m === "veo3" || m === "veo3.1" || m === "veo3_fast") {
    return { providerKind: "KIE", requestKind: "VIDEO" };
  }

  if (m.startsWith("hailuo/")) {
    return { providerKind: "KIE", requestKind: "VIDEO" };
  }

  if (m.startsWith("grok-imagine/") && m.includes("text-to-image")) {
    return { providerKind: "KIE", requestKind: "IMAGE" };
  }

  if (
    m.startsWith("grok-imagine/") ||
    m.startsWith("grok-imagine-video")
  ) {
    return { providerKind: "KIE", requestKind: "VIDEO" };
  }

  if (
    m === "wan/2-6-video-to-video" ||
    m.includes("motion-control") ||
    m.startsWith("topaz/")
  ) {
    return { providerKind: "KIE", requestKind: "VIDEO" };
  }

  if (m.startsWith("happyhorse/")) {
    return { providerKind: "KIE", requestKind: "VIDEO" };
  }

  if (KIE_CHAT_MODELS.has(m)) {
    return { providerKind: "KIE", requestKind: "CHAT" };
  }

  if (
    /^gemini-\d+(\.\d+)?-flash(-preview)?$/i.test(m) ||
    /^google\/gemini-\d+(\.\d+)?-flash(-preview)?$/i.test(m)
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

  if (isKieSunoModelKey(raw) || isKieSunoModelKey(m)) {
    return { providerKind: "KIE", requestKind: "MUSIC" };
  }

  if (isKieElevenLabsMarketModelKey(raw) || isKieElevenLabsMarketModelKey(m)) {
    return { providerKind: "KIE", requestKind: "TTS" };
  }

  if (m.startsWith("elevenlabs/")) {
    return { providerKind: "KIE", requestKind: "TTS" };
  }

  if (isMinimaxSpeechModelKey(raw) || isMinimaxSpeechModelKey(m)) {
    return { providerKind: "MINIMAX", requestKind: "TTS" };
  }

  if (isMinimaxMusicModelKey(raw) || isMinimaxMusicModelKey(m)) {
    return { providerKind: "MINIMAX", requestKind: "MUSIC" };
  }

  if (isElevenLabsStsModelKey(raw) || isElevenLabsStsModelKey(m)) {
    return { providerKind: "ELEVENLABS", requestKind: "TTS" };
  }

  if (isElevenLabsSfxModelKey(raw) || isElevenLabsSfxModelKey(m)) {
    return { providerKind: "ELEVENLABS", requestKind: "OTHER" };
  }

  if (isElevenLabsMusicModelKey(raw) || isElevenLabsMusicModelKey(m)) {
    return { providerKind: "ELEVENLABS", requestKind: "MUSIC" };
  }

  if (m.startsWith("eleven/")) {
    return { providerKind: "ELEVENLABS", requestKind: "TTS" };
  }

  if (isWorldlabsMarbleModelKey(raw) || isWorldlabsMarbleModelKey(m)) {
    return { providerKind: "WORLDLABS", requestKind: "OTHER" };
  }

  if (
    isTopazLabsVideoModelKey(raw) ||
    isTopazLabsVideoModelKey(m) ||
    m.startsWith("topaz-labs/")
  ) {
    return { providerKind: "TOPAZ", requestKind: "VIDEO" };
  }

  if (m.includes("qwen") || m.includes("bailian") || (m.includes("minimax") && !m.includes("speech") && !m.includes("music"))) {
    return { providerKind: "BAILIAN", requestKind: "CHAT" };
  }

  throw new UnknownGatewayModelError(raw || model);
}

/** OpenAI 兼容 Chat/TTS 的 DashScope 根地址（勿与 api/v1 异步任务根混用） */
export function defaultBaseUrl(kind: GatewayProviderKind): string {
  switch (kind) {
    case "DEEPSEEK":
      return "https://api.deepseek.com/v1";
    case "MOONSHOT":
      return "https://api.moonshot.cn/v1";
    case "BAILIAN":
    case "DASHSCOPE":
      return "https://dashscope.aliyuncs.com/compatible-mode/v1";
    case "HUNYUAN":
      return "https://api.ai3d.cloud.tencent.com";
    case "VOLCENGINE":
      return "https://ark.cn-beijing.volces.com/api/v3";
    case "MINIMAX":
      return "https://api.minimaxi.com";
    case "WORLDLABS":
      return "https://api.worldlabs.ai";
    case "ELEVENLABS":
      return "https://api.elevenlabs.io";
    case "TOPAZ":
      return "https://api.topazlabs.com";
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
const MOONSHOT_HOST_RE = /^https?:\/\/api\.moonshot\.cn\/?$/i;

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

/** Moonshot / Kimi OpenAI 兼容端点须带 /v1。 */
export function resolveMoonshotBaseUrl(
  baseUrl: string | null | undefined,
): string {
  const fallback = defaultBaseUrl("MOONSHOT").replace(/\/$/, "");
  const raw = (baseUrl?.trim() || fallback).replace(/\/$/, "");
  if (!raw) return fallback;
  if (MOONSHOT_HOST_RE.test(raw)) return `${raw}/v1`;
  if (/api\.moonshot\.cn/i.test(raw) && !/\/v\d+$/i.test(raw)) {
    return `${raw}/v1`;
  }
  return raw;
}

/** Kimi 模型 temperature / top_p 等为固定值；K2.6 thinking_mode → thinking 对象。 */
export function resolveMoonshotChatCompletionsBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...body };
  delete out.temperature;
  delete out.top_p;
  delete out.n;
  delete out.presence_penalty;
  delete out.frequency_penalty;

  const model =
    typeof out.model === "string" ? out.model.trim().toLowerCase() : "";
  const thinkingMode = out.thinking_mode;
  if (typeof thinkingMode === "string" && model === "kimi-k2.6") {
    out.thinking = { type: thinkingMode === "disabled" ? "disabled" : "enabled" };
  }
  delete out.thinking_mode;

  return out;
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

  if (kind === "KIE") {
    return resolveKieApiRoot(baseUrl);
  }

  if (kind === "MOONSHOT") {
    return resolveMoonshotBaseUrl(baseUrl);
  }

  if (kind === "DEEPSEEK") {
    return resolveDeepSeekBaseUrl(baseUrl);
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

/**
 * KIE OpenAPI 根（https://api.kie.ai）。
 * 凭证 baseUrl 若误填 gemini/codex 完整路径，在此剥 suffix，避免拼出无效 URL。
 */
export function resolveKieApiRoot(baseUrl?: string | null): string {
  const fallback = defaultBaseUrl("KIE").replace(/\/$/, "");
  let raw = (baseUrl?.trim() || fallback).replace(/\/$/, "");
  if (!raw) return fallback;
  raw = raw.replace(/\/codex\/v1.*$/i, "");
  raw = raw.replace(
    /\/gemini-[0-9.]+(?:-[a-z]+)?(?:-preview)?\/v\d+.*$/i,
    "",
  );
  raw = raw.replace(/\/chat\/completions$/i, "");
  return raw.replace(/\/$/, "") || fallback;
}

/** KIE Gemini Chat 端点路径段（OpenAI 兼容 /{segment}/v1/chat/completions） */
export function resolveKieGeminiChatPath(modelKey: string): string {
  const m = modelKey.trim().toLowerCase();
  if (m.includes("2.5") && m.includes("flash")) {
    return "gemini-2.5-flash";
  }
  return "gemini-3-flash";
}

export {
  isKieCodexChatModel,
  resolveKieCodexUpstreamModel,
} from "@/lib/gateway/kie-codex-chat";

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
