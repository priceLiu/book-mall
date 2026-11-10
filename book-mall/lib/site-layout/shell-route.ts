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

export function prefersSiteHomeBody(pathname: string): boolean {
  return (
    pathname.startsWith("/products") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/pricing-disclosure")
  );
}
