import { SiteHomeV2Chrome } from "@/components/site-home-v2/site-home-v2-chrome";

/** 个人中心：V2 Apple 顶栏 + 浅色 app shell 内容区 */
export function AccountAppShell({
  children,
  navAuth,
}: {
  children: React.ReactNode;
  navAuth: React.ReactNode;
}) {
  return (
    <SiteHomeV2Chrome isLoggedIn authSlot={navAuth} siteHomeBody>
      <div className="site-app-shell min-h-[calc(100vh-var(--header-h))] overflow-x-clip">
        {children}
      </div>
    </SiteHomeV2Chrome>
  );
}
