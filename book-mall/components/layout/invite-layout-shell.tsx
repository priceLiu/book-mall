import Image from "next/image";

import { ToggleTheme } from "@/components/layout/toogle-theme";

/** 团队邀请等独立流程：精简顶栏，避免干扰注册/加入。 */
export function InviteLayoutShell({
  navAuth,
  children,
}: {
  navAuth: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div data-site-home className="min-h-screen overflow-x-clip">
      <div className="site-home-page-bg min-h-screen overflow-x-clip">
        <header className="site-home-nav w-full">
          <div className="site-home-nav-container">
            <div className="site-home-nav-left">
              <span className="site-home-nav-logo shrink-0 cursor-default" aria-label="智选 AI">
                <Image
                  src="/logo2.png"
                  alt="智选 AI"
                  width={144}
                  height={144}
                  className="h-9 w-auto object-contain"
                  priority
                />
              </span>
            </div>
            <div className="site-home-nav-center-glass hidden sm:flex">
              <p className="site-home-nav-center px-3 text-sm text-muted-foreground">团队邀请</p>
            </div>
            <div className="site-home-nav-right">
              <div className="site-home-nav-opts flex items-center gap-2">
                <ToggleTheme
                  iconOnly
                  className="site-home-nav-icon-btn h-9 w-9 text-[hsl(215,16%,65%)] hover:bg-transparent hover:text-foreground [&_svg]:size-5"
                />
                {navAuth}
              </div>
            </div>
          </div>
        </header>
        <div className="site-home-nav-spacer" aria-hidden />
        {children}
      </div>
    </div>
  );
}
