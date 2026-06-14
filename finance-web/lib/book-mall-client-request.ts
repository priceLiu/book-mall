/**
 * finance-web 与 book-mall 不同源时，浏览器经同源 `/api/book-mall/*` BFF 代理转发 Cookie。
 * 本地 :3002↔:3000 端口不同亦视为跨源，与生产行为一致，无需 book-mall 配 FINANCE_WEB_ORIGINS。
 */
export function shouldUseBookMallBrowserProxy(base: string): boolean {
  if (!base || typeof window === "undefined") return false;
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
