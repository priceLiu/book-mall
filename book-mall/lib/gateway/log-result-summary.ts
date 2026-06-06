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
