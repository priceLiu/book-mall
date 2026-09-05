const SSO_INTERNAL_PATH_PREFIXES = [
  "/sso-error",
  "/auth/sso/callback",
  "/auth/sso/silent-done",
] as const;

/** 未登录可浏览的门户页（不触发冷启动 SSO 整页换票）。 */
export function isCommonToolsPublicBrowsePath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login" || pathname === "/register") {
    return true;
  }
  if (pathname === "/t" || pathname.startsWith("/t/")) return true;
  return false;
}

export function isCommonToolsPublicSsoPath(pathname: string): boolean {
  if (isCommonToolsPublicBrowsePath(pathname)) return true;
  return SSO_INTERNAL_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
