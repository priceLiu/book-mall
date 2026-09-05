export function isNonRetryableBookMallProxyError(
  status: number,
  message: string,
): boolean {
  const t = message.trim();
  if (
    t.includes("book_mall_url_missing") ||
    t.includes("book_mall_route_missing") ||
    t.includes("未配置主站地址")
  ) {
    return true;
  }
  try {
    const j = JSON.parse(t) as { error?: string };
    return (
      j.error === "book_mall_url_missing" ||
      j.error === "book_mall_route_missing"
    );
  } catch {
    return false;
  }
}

export function isTransientDbApiError(status: number, message: string): boolean {
  if (isNonRetryableBookMallProxyError(status, message)) return false;
  const t = message.trim();
  return (
    status === 502 ||
    status === 503 ||
    status === 429 ||
    t.includes("DATABASE_UNAVAILABLE") ||
    t.includes("系统繁忙")
  );
}

/** 浏览器 fetch 层网络中断（无 HTTP 状态码）；不含主动 abort 的超时取消 */
export function isTransientNetworkFetchError(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (t === "save_timeout" || t === "save_wait_timeout") return false;
  if (/operation was aborted|AbortError|The user aborted/i.test(t)) return false;
  return (
    /failed to fetch/i.test(t) ||
    /networkerror/i.test(t) ||
    /network request failed/i.test(t) ||
    /load failed/i.test(t) ||
    /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(t) ||
    /book_mall_proxy/i.test(t)
  );
}

export function transientDbRetryDelayMs(attempt: number): number {
  return Math.min(800 + attempt * 700, 4000);
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
