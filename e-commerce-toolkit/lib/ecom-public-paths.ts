/** 未登录可浏览的门户页（不触发冷启动 SSO 整页换票）。 */
const ECOM_PUBLIC_BROWSE_EXACT = new Set(["/", "/login", "/register"]);

const ECOM_SSO_INTERNAL_PREFIXES = [
  "/sso-error",
  "/auth/sso/callback",
  "/auth/sso/silent-done",
] as const;

export function isEcomPublicBrowsePath(pathname: string): boolean {
  return ECOM_PUBLIC_BROWSE_EXACT.has(pathname);
}

export function isEcomPublicSsoPath(pathname: string): boolean {
  if (isEcomPublicBrowsePath(pathname)) return true;
  return ECOM_SSO_INTERNAL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
