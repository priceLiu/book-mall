/**
 * 请求 book-mall 上游；开发环境对 localhost 短暂重试，避免 dev:all 启动竞态导致未捕获 fetch 报错。
 */
export async function fetchBookMall(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const isLocalDev =
    process.env.NODE_ENV === "development" &&
    /localhost|127\.0\.0\.1/.test(url);

  const maxAttempts = isLocalDev ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    try {
      return await fetch(url, { ...init, cache: "no-store" });
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError;
}

export function bookMallFetchErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause =
    e.cause instanceof Error ? e.cause.message : String(e.cause ?? "");
  if (cause) return `${e.message} (${cause})`;
  return e.message;
}
