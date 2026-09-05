/**
 * 门户首页匿名可读 GET — BFF 代理可跳过 tools_token refresh。
 * 与 book-mall `CANVAS_PORTAL_PUBLIC_GET_PATHS` 对齐；首页 SSR 快照失败时客户端亦会走这些路径。
 */
const PORTAL_PUBLIC_GET_PATHS = [
  "api/canvas/viewer-session",
  "api/public/static-snapshots/canvas-home",
  "api/canvas/projects/portal-featured",
  "api/canvas/projects/portal-cases",
  "api/canvas/projects/portal-film-showcase",
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
