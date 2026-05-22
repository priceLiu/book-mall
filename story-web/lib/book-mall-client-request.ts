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
