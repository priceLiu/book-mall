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
    <div data-site-home className="dark min-h-screen overflow-x-clip">
      <header className="site-home-nav sticky top-0 z-[999] w-full border-b">
        <div className="site-home-nav-container">
          <span className="site-home-nav-logo shrink-0 cursor-default" aria-label="智选 AI">
            <Image
              src="/logo2.png"
              alt="智选 AI"
              width={144}
              height={144}
              className="h-9 w-auto object-contain dark:mix-blend-screen"
              priority
            />
          </span>
          <p className="hidden text-sm text-muted-foreground sm:block">团队邀请</p>
          <div className="site-home-nav-opts ml-auto flex items-center gap-2">
            <ToggleTheme
              iconOnly
              className="site-home-nav-icon-btn h-9 w-9 text-[hsl(215,16%,65%)] hover:bg-transparent hover:text-foreground [&_svg]:size-5"
            />
            {navAuth}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
