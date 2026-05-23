/**
 * 决定浏览器侧调 book-mall API 时走「同站代理」(`/api/book-mall/*`) 还是直连。
 *
 * 一旦页面 origin 与 book-mall origin 不同（包括本地 :3004 ↔ :3000 这种端口跨源），
 * 一律走代理：
 *   - 同源请求，浏览器自动把全部 host-only cookie（包含 :3000 设的 next-auth.session-token）
 *     发给 canvas-web；
 *   - canvas-web 的代理 route 在 server-to-server 调用时把 Cookie 头原样转给 book-mall。
 *
 * 这样规避了浏览器对 SameSite=Lax cookie 在跨 origin fetch 时是否发送的实现差异，
 * 也省掉了 CORS preflight。
 */
export function shouldUseBookMallBrowserProxy(base: string): boolean {
  if (!base || typeof window === "undefined") return false;
  try {
    return new URL(base).origin !== window.location.origin;
  } catch {
    return false;
  }
}

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
