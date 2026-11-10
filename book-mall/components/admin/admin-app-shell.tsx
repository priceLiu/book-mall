import { SiteHomeV2Chrome } from "@/components/site-home-v2/site-home-v2-chrome";

/** 管理后台：V2 Apple 顶栏 + 浅色内容区 */
export function AdminAppShell({
  children,
  navAuth,
}: {
  children: React.ReactNode;
  navAuth: React.ReactNode;
}) {
  return (
    <SiteHomeV2Chrome isLoggedIn authSlot={navAuth} surface="admin" siteHomeBody>
      <div className="admin-shell-root site-app-shell min-h-[calc(100vh-var(--header-h))] overflow-x-clip">
        {children}
      </div>
    </SiteHomeV2Chrome>
  );
}
