/** 将 undici「fetch failed」包装为可诊断文案（内部 loopback vs 厂商 upstream）。 */

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
  const isTimeout =
    /timeout|timed out|connect timeout/i.test(causeMsg) ||
    (cause as { code?: string })?.code === "UND_ERR_CONNECT_TIMEOUT";

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
      ? `${provider} API 连接超时，请检查网络或 Gateway 凭证 baseUrl 后重试。`
      : `${provider} API 请求失败：${causeMsg || "fetch failed"}`,
  );
}

export async function gatewayFetch(
  url: string,
  init: RequestInit,
  ctx?: { hop?: "internal" | "upstream"; providerKind?: string },
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    throw formatGatewayFetchError(url, e, ctx);
  }
}
