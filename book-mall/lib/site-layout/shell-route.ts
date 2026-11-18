/** marketing (site) 布局壳路由分流（服务端，勿在 layout 用 usePathname client） */

export function isHomeV2Route(pathname: string): boolean {
  return pathname === "/home-v2" || pathname.startsWith("/home-v2/");
}

export function isPricingRoute(pathname: string): boolean {
  return pathname === "/pricing" || pathname.startsWith("/pricing/");
}

export function isLegacyHome(pathname: string): boolean {
  return pathname === "/";
}

/** 登录/注册全屏分屏，不再套营销顶栏 */
export function isAuthFullscreenRoute(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/invite/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/legacy/") ||
    pathname.startsWith("/legal/")
  );
}

export function prefersSiteHomeBody(pathname: string): boolean {
  return (
    pathname.startsWith("/products") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/pricing-disclosure")
  );
}
