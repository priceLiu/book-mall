import {
  parseUsageFromUnknown,
  type UsageFromResponse,
} from "@/lib/gateway/gateway-token-metrics";

/** Gateway 日志 resultSummary 构建（Chat / 媒体） */

function vendorUsageForSummary(parsed: unknown): UsageFromResponse | undefined {
  const u = parseUsageFromUnknown(parsed);
  if (
    u.totalTokens != null ||
    u.promptTokens != null ||
    u.completionTokens != null
  ) {
    return u;
  }
  return undefined;
}

/** 异步任务：优先存厂商 raw，便于读时解析 usage */
export function buildGatewayTaskResultSummary(
  raw: unknown,
  slim?: Record<string, unknown> | null,
): unknown {
  if (raw != null && typeof raw === "object") return raw;
  return slim ?? undefined;
}

export function buildGatewayChatResultSummary(
  parsed: unknown,
): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const usage = vendorUsageForSummary(parsed);
  const choice = Array.isArray(obj.choices)
    ? (obj.choices[0] as Record<string, unknown> | undefined)
    : undefined;
  const message =
    choice?.message && typeof choice.message === "object"
      ? (choice.message as Record<string, unknown>)
      : null;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) {
    return {
      kind: "chat",
      text: content.slice(0, 12000),
      ...(usage ? { usage } : {}),
    };
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    const urls: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "text" && typeof p.text === "string") {
        parts.push(p.text);
      }
      const iu = p.image_url;
      if (
        iu &&
        typeof iu === "object" &&
        typeof (iu as { url?: string }).url === "string"
      ) {
        urls.push((iu as { url: string }).url);
      }
    }
    if (parts.length || urls.length) {
      return {
        kind: "chat",
        text: parts.join("\n").slice(0, 12000),
        ...(urls.length ? { imageUrls: urls } : {}),
        ...(usage ? { usage } : {}),
      };
    }
  }
  if (usage) {
    return { kind: "chat", usage };
  }
  return null;
}

const TTS_LOG_EMBED_MAX_BYTES = 512_000;

/** TTS 终态：Gateway Result 列可播放 audio_url / data URL */
export function buildGatewayTtsResultSummary(opts: {
  audioUrl?: string | null;
  buffer?: Buffer | null;
  contentType?: string;
  vendorJson?: unknown;
}): Record<string, unknown> {
  const contentType = opts.contentType?.trim() || "audio/mpeg";
  const httpUrl =
    typeof opts.audioUrl === "string" && /^https?:\/\//.test(opts.audioUrl.trim())
      ? opts.audioUrl.trim()
      : null;
  if (httpUrl) {
    return { kind: "tts", audio_url: httpUrl, url: httpUrl, contentType };
  }

  const buf = opts.buffer;
  if (buf && buf.length > 0 && buf.length <= TTS_LOG_EMBED_MAX_BYTES) {
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
    return {
      kind: "tts",
      audio_url: dataUrl,
      url: dataUrl,
      contentType,
      byteLength: buf.length,
    };
  }

  const slim = buildGatewayTaskResultSummary(opts.vendorJson, {
    contentType,
    byteLength: buf?.length ?? 0,
  });
  if (slim && typeof slim === "object" && !Array.isArray(slim)) {
    return { kind: "tts", ...(slim as Record<string, unknown>) };
  }
  return { kind: "tts", contentType, byteLength: buf?.length ?? 0 };
}

/** 流式 Chat 终态：写入厂商 usage 供读时补算 */
export function buildGatewayStreamChatResultSummary(
  usage: UsageFromResponse,
): Record<string, unknown> | undefined {
  if (
    usage.totalTokens == null &&
    usage.promptTokens == null &&
    usage.completionTokens == null
  ) {
    return undefined;
  }
  return { kind: "chat_stream", usage };
}
