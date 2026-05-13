import { TOOL_SUITE_NAV_KEYS, type ToolSuiteNavKey } from "@/lib/tool-suite-nav-keys";

/** 将路径前缀映射到工具套件分组 navKey；不匹配则返回 null（视为无需套件门禁的页面）。 */
export function pathnameToToolSuiteNavKey(pathname: string): ToolSuiteNavKey | null {
  const seg = pathname.replace(/^\//, "").split("/").filter(Boolean)[0];
  if (!seg) return null;
  return TOOL_SUITE_NAV_KEYS.includes(seg as ToolSuiteNavKey)
    ? (seg as ToolSuiteNavKey)
    : null;
}

/** 根路径与 SSO 回调等不做套件门禁 */
export function isToolPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/auth")) return true;
  return false;
}
