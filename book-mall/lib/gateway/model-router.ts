import type { GatewayProviderKind } from "@prisma/client";

const DEEPSEEK_MODELS = new Set([
  "deepseek-chat",
  "deepseek-reasoner",
  "deepseek-coder",
]);

const KIE_CHAT_MODELS = new Set(["gemini-3-flash", "google/gemini-3-flash"]);

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

  if (m.includes("qwen") || m.includes("bailian")) {
    return { providerKind: "BAILIAN", requestKind: "CHAT" };
  }

  return { providerKind: "KIE", requestKind: "OTHER" };
}

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
