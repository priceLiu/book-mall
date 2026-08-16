import { SiteHomeNav } from "@/components/layout/site-home/site-home-nav";

/** 个人中心浅色顶栏：保留门户导航，不用营销首页深色 fixed 顶栏 */
export function AccountAppShell({
  children,
  navAuth,
}: {
  children: React.ReactNode;
  navAuth: React.ReactNode;
}) {
  return (
    <div data-site-home className="min-h-screen overflow-x-clip">
      <div className="site-app-shell site-home-page-bg min-h-screen overflow-x-clip">
        <SiteHomeNav variant="account" isLoggedIn>
          {navAuth}
        </SiteHomeNav>
        {children}
      </div>
    </div>
  );
}
