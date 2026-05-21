/**
 * 生产环境 finance-web 与 book-mall 不同源，浏览器跨域带 Cookie 常被拦。
 * 对非 localhost 且与主站不同 origin 的请求，改走 finance-web 同源 `/api/book-mall/*` 代理。
 */
export function shouldUseBookMallBrowserProxy(base: string): boolean {
  if (!base || typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;
  try {
    return new URL(base).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** @param apiPath 须以 `/api/` 开头，可含 query */
export function resolveBookMallBrowserRequest(
  base: string,
  apiPath: string,
  init?: RequestInit,
): { url: string; init: RequestInit } {
  const merged: RequestInit = { cache: "no-store", ...init };
  if (shouldUseBookMallBrowserProxy(base)) {
    const path = apiPath.replace(/^\//, "");
    return {
      url: `/api/book-mall/${path}`,
      init: { ...merged, credentials: "same-origin" },
    };
  }
  const origin = base.replace(/\/$/, "");
  return {
    url: `${origin}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
    init: { ...merged, credentials: "include", mode: "cors" },
  };
}
