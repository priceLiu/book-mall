/** 主站「重新进入工具站」入口（GET；未登录会经登录页再回到此处签发跳转）。 */

export function mainSiteToolsReEnterHref(
  mainOrigin: string | null,
  redirectPath: string,
): string | null {
  if (!mainOrigin) return null;
  const base = mainOrigin.replace(/\/$/, "");
  const path = `/api/sso/tools/re-enter?redirect=${encodeURIComponent(redirectPath)}`;
  return `${base}${path}`;
}
