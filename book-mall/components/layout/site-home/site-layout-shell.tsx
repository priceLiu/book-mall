"use client";

import { usePathname } from "next/navigation";
import { SiteHomeNav } from "@/components/layout/site-home/site-home-nav";

function isMarketingDarkShell(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/pricing" || pathname.startsWith("/pricing/")) return true;
  if (pathname.startsWith("/products")) return true;
  if (pathname.startsWith("/courses")) return true;
  return false;
}

export function SiteLayoutShell({
  navAuth,
  isLoggedIn,
  children,
}: {
  navAuth: React.ReactNode;
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const useFullDarkShell = isMarketingDarkShell(pathname);

  if (useFullDarkShell) {
    return (
      <div data-site-home className="min-h-screen overflow-x-clip">
        <div className="site-home-page-bg min-h-screen overflow-x-clip">
          <SiteHomeNav isLoggedIn={isLoggedIn}>{navAuth}</SiteHomeNav>
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      <div data-site-home-header>
        <SiteHomeNav isLoggedIn={isLoggedIn}>{navAuth}</SiteHomeNav>
      </div>
      {children}
    </>
  );
}
