/** 将 undici「fetch failed」包装为可诊断文案（内部 loopback vs 厂商 upstream）。 */

const UPSTREAM_CHAT_TIMEOUT_MS = 180_000;

function mergeUpstreamAbortSignal(init: RequestInit): RequestInit {
  if (init.signal) return init;
  try {
    return { ...init, signal: AbortSignal.timeout(UPSTREAM_CHAT_TIMEOUT_MS) };
  } catch {
    return init;
  }
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
  const isTimeout = isConnectTimeoutError(err);

  if (ctx?.hop === "internal") {
    return new Error(
      isTimeout
        ? "Gateway 内部链路超时（book-mall 自调用 /api/gw/v1）。开发环境 mall 编译中时会偶发，请稍候重试。"
        : `Gateway 内部链路失败：${causeMsg || "fetch failed"}`,
    );
  }

  const provider = ctx?.providerKind?.trim() || "模型厂商";
  return new Error(
    isTimeout
      ? formatUpstreamTimeoutMessage(provider)
      : `${provider} API 请求失败：${causeMsg || "fetch failed"}`,
  );
}

function isConnectTimeoutError(err: unknown): boolean {
  const cause =
    err instanceof Error && err.cause != null ? err.cause : err;
  const causeMsg =
    cause instanceof Error
      ? cause.message
      : cause != null
        ? String(cause)
        : "";
  return (
    /timeout|timed out|connect timeout|ssl connection timeout|socket timeout/i.test(
      causeMsg,
    ) ||
    (cause as { code?: string })?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    (cause as { code?: string })?.code === "UND_ERR_HEADERS_TIMEOUT" ||
    (cause as { code?: string })?.code === "UND_ERR_BODY_TIMEOUT"
  );
}

export async function gatewayFetch(
  url: string,
  init: RequestInit,
  ctx?: { hop?: "internal" | "upstream"; providerKind?: string },
): Promise<Response> {
  const reqInit =
    ctx?.hop === "upstream" ? mergeUpstreamAbortSignal(init) : init;
  try {
    return await fetch(url, reqInit);
  } catch (e) {
    if (ctx?.hop === "upstream" && isConnectTimeoutError(e)) {
      try {
        return await fetch(url, reqInit);
      } catch (retryErr) {
        throw formatGatewayFetchError(url, retryErr, ctx);
      }
    }
    throw formatGatewayFetchError(url, e, ctx);
  }
}
