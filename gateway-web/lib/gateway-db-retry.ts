/** 数据库连接池瞬时耗尽 / 主站不可达：客户端静默重试 */
export function isGatewayTransientFetchError(
  status: number,
  body?: string | null,
): boolean {
  if (status === 502 || status === 503 || status === 429) return true;
  const t = (body ?? "").trim();
  return (
    t.includes("DATABASE_UNAVAILABLE") ||
    t.includes("系统繁忙") ||
    t.includes("book_mall_fetch_failed") ||
    t.includes("book_mall_proxy_failed") ||
    t.includes("book_mall_unreachable")
  );
}

export function gatewayTransientRetryDelayMs(attempt: number): number {
  return Math.min(800 + attempt * 700, 4000);
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
