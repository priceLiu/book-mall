/** 将 undici「fetch failed」包装为可诊断文案（内部 loopback vs 厂商 upstream）。 */

import dns from "node:dns";

/** 生产容器 IPv6 优先时连 api.kie.ai 等厂商易 ECONNREFUSED，固定 IPv4 优先 */
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* Node < 17 */
}

const UPSTREAM_CHAT_TIMEOUT_MS = readUpstreamTimeoutMs(
  "UPSTREAM_CHAT_TIMEOUT_MS",
  180_000,
);
/** Pro2 剧本 / max_tokens≥8k 的长文 CHAT：默认 10min（180s 不足以输出完整 GFM 制作包） */
const UPSTREAM_STORY_CHAT_TIMEOUT_MS = readUpstreamTimeoutMs(
  "UPSTREAM_STORY_CHAT_TIMEOUT_MS",
  600_000,
);
const UPSTREAM_CREATE_TASK_TIMEOUT_MS = readUpstreamTimeoutMs(
  "UPSTREAM_CREATE_TASK_TIMEOUT_MS",
  120_000,
);
/** chat/completions body.max_tokens 达到此值时使用 STORY 超时 */
export const UPSTREAM_STORY_CHAT_MAX_TOKENS_THRESHOLD = 8_000;

function readUpstreamTimeoutMs(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function mergeUpstreamAbortSignal(
  init: RequestInit,
  timeoutMs: number,
): RequestInit {
  if (init.signal) return init;
  try {
    return { ...init, signal: AbortSignal.timeout(timeoutMs) };
  } catch {
    return init;
  }
}

/** 供单测与 Canvas 诊断：按 URL + body 解析 upstream fetch 超时。 */
export function resolveUpstreamChatTimeoutMs(
  url: string,
  init: RequestInit,
): number {
  if (init.method?.toUpperCase() === "POST" && /\/createTask$/i.test(url)) {
    return UPSTREAM_CREATE_TASK_TIMEOUT_MS;
  }
  if (/\/multimodal-generation\//i.test(url)) {
    return UPSTREAM_STORY_CHAT_TIMEOUT_MS;
  }
  // KIE GPT-5.5 codex · 剧本长文；body 无 max_tokens，须单独放宽
  if (init.method?.toUpperCase() === "POST" && /\/codex\/v1\/responses/i.test(url)) {
    return UPSTREAM_STORY_CHAT_TIMEOUT_MS;
  }
  const maxTokens = readChatMaxTokensFromBody(init.body);
  if (
    typeof maxTokens === "number" &&
    maxTokens >= UPSTREAM_STORY_CHAT_MAX_TOKENS_THRESHOLD
  ) {
    return UPSTREAM_STORY_CHAT_TIMEOUT_MS;
  }
  return UPSTREAM_CHAT_TIMEOUT_MS;
}

function readChatMaxTokensFromBody(body: BodyInit | null | undefined): number | undefined {
  if (typeof body !== "string" || !body.trim()) return undefined;
  try {
    const parsed = JSON.parse(body) as { max_tokens?: unknown };
    const mt = parsed.max_tokens;
    return typeof mt === "number" && Number.isFinite(mt) ? mt : undefined;
  } catch {
    return undefined;
  }
}

function upstreamTimeoutMs(url: string, init: RequestInit): number {
  return resolveUpstreamChatTimeoutMs(url, init);
}

function formatUpstreamTimeoutMessage(provider: string): string {
  const label =
    provider === "VOLCENGINE"
      ? "火山方舟"
      : provider === "KIE"
        ? "KIE"
        : provider === "BAILIAN"
          ? "百炼"
          : provider === "DEEPSEEK"
            ? "DeepSeek"
            : provider === "MOONSHOT"
              ? "Kimi"
              : provider;
  return `${label} API 连接超时，请稍后重试。`;
}

export function formatGatewayFetchError(
  target: string,
  err: unknown,
  ctx?: { hop?: "internal" | "upstream"; providerKind?: string },
): Error {
  const cause =
    err instanceof Error && err.cause != null ? err.cause : err;
  const causeMsg =
    cause instanceof Error
      ? cause.message
      : cause != null
        ? String(cause)
        : "";
  const isTransient = isTransientUpstreamConnectError(err);

  if (ctx?.hop === "internal") {
    return new Error(
      isTransient
        ? "Gateway 内部链路超时（book-mall 自调用 /api/gw/v1）。开发环境 mall 编译中时会偶发，请稍候重试。"
        : `Gateway 内部链路失败：${causeMsg || "fetch failed"}`,
    );
  }

  const provider = ctx?.providerKind?.trim() || "模型厂商";
  return new Error(
    isTransient
      ? formatUpstreamTimeoutMessage(provider)
      : `${provider} API 请求失败：${causeMsg || "fetch failed"}`,
  );
}

function collectFetchErrorBlob(err: unknown): string {
  const cause =
    err instanceof Error && err.cause != null ? err.cause : err;
  const causeMsg =
    cause instanceof Error
      ? cause.message
      : cause != null
        ? String(cause)
        : "";
  const errMsg = err instanceof Error ? err.message : "";
  const causeCode =
    cause != null && typeof cause === "object"
      ? String((cause as { code?: string }).code ?? "")
      : "";
  const errCode =
    err != null && typeof err === "object"
      ? String((err as { code?: string }).code ?? "")
      : "";
  return `${errMsg} ${causeMsg} ${causeCode} ${errCode}`;
}

/**
 * 上游握手/断线可重试：超时、TLS 未建立就断开、socket reset。
 * 不含 ECONNREFUSED（多为地址/IPv6 问题，立即重试通常同样失败）。
 */
export function isTransientUpstreamConnectError(err: unknown): boolean {
  const blob = collectFetchErrorBlob(err);
  return (
    /timeout|timed out|connect timeout|ssl connection timeout|socket timeout/i.test(
      blob,
    ) ||
    /socket disconnected|secure TLS connection|ECONNRESET|EPIPE|UND_ERR_SOCKET|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT/i.test(
      blob,
    )
  );
}

export async function gatewayFetch(
  url: string,
  init: RequestInit,
  ctx?: { hop?: "internal" | "upstream"; providerKind?: string },
): Promise<Response> {
  const reqInit =
    ctx?.hop === "upstream"
      ? mergeUpstreamAbortSignal(init, upstreamTimeoutMs(url, init))
      : init;
  try {
    return await fetch(url, reqInit);
  } catch (e) {
    if (ctx?.hop === "upstream" && isTransientUpstreamConnectError(e)) {
      try {
        return await fetch(url, reqInit);
      } catch (retryErr) {
        throw formatGatewayFetchError(url, retryErr, ctx);
      }
    }
    throw formatGatewayFetchError(url, e, ctx);
  }
}
