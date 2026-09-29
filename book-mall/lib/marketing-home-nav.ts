import { marketingHomeSectionUrl } from "@/lib/portal-nav";

/** 首页锚点（#hero-video 等）在非首页 / 个人中心的安全跳转，避免 router.push(`/#…`) 触发异常路由。 */
export function navigateMarketingHomeSection(
  hash: string,
  pathname: string,
  options?: { openInNewTab?: boolean },
): void {
  const fragment = hash.startsWith("#") ? hash : `#${hash}`;
  const sectionId = fragment.slice(1);
  const openInNewTab = options?.openInNewTab ?? pathname !== "/";

  if (pathname === "/") {
    window.history.replaceState(null, "", fragment);
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    });
    return;
  }

  const url = marketingHomeSectionUrl(window.location.origin, fragment);
  if (openInNewTab) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(url);
    return;
  }
  window.location.assign(url);
}
