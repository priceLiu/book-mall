/** 资产/暂存/姿势库等浏览页 */
export function isEcomBrowseHubPath(pathname: string): boolean {
  return (
    pathname === "/library" ||
    pathname === "/workflows/drafts" ||
    pathname === "/ecom/shoot-catalog"
  );
}

/** 创作台/浏览页：点击工作区不自动收起左侧导航，便于切换模块 */
export function isEcomNavPersistentPath(pathname: string): boolean {
  if (isEcomBrowseHubPath(pathname)) return true;
  if (pathname === "/") return true;
  return pathname.startsWith("/ecom/") || pathname.startsWith("/brand/");
}
