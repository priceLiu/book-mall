/**
 * 门户首页匿名可读 GET — BFF 代理可跳过 tools_token refresh。
 * 首页发现/视频墙已静态快照化，不再经此列表拉 portal-* / templates。
 */
const PORTAL_PUBLIC_GET_PATHS = [
  "api/canvas/viewer-session",
] as const;

export function isBookMallPortalPublicGetProxy(
  method: string,
  path: string,
  search: string,
): boolean {
  if (method !== "GET" && method !== "HEAD") return false;

  if (
    (PORTAL_PUBLIC_GET_PATHS as readonly string[]).includes(path) ||
    PORTAL_PUBLIC_GET_PATHS.some(
      (prefix) => path.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  if (path === "api/canvas/templates") {
    const scope = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(
      "scope",
    );
    return scope === "public" || scope === "featured";
  }

  return false;
}
