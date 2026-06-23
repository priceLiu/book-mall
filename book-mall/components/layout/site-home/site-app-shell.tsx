"use client";

import { SiteHomeNav } from "@/components/layout/site-home/site-home-nav";

/**
 * 个人中心 / 管理后台等与营销首页对齐的浅色壳：GitHub token + 固定顶栏。
 */
export function SiteAppShell({
  children,
  isLoggedIn,
  navAuth,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
  navAuth: React.ReactNode;
}) {
  return (
    <div data-site-home className="min-h-screen overflow-x-clip">
      <div className="site-home-page-bg min-h-screen overflow-x-clip">
        <SiteHomeNav isLoggedIn={isLoggedIn}>{navAuth}</SiteHomeNav>
        {children}
      </div>
    </div>
  );
}
