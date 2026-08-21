/**
 * canvas-web 无需 tools_token 即可访问的路由（CanvasAuthGate 白名单）。
 * 首页 `/` 及登录注册须公开；个人画布 / 项目资产等走 RequireAuth。
 */
export const CANVAS_PUBLIC_EXACT_PATHS = ["/", "/login", "/register"] as const;

export const CANVAS_PUBLIC_PREFIXES = ["/auth/", "/sso-error"] as const;

export function isPublicCanvasPath(pathname: string): boolean {
  const path = pathname || "/";
  if ((CANVAS_PUBLIC_EXACT_PATHS as readonly string[]).includes(path)) {
    return true;
  }
  return CANVAS_PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}
