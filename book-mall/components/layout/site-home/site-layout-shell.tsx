"use client";

import { usePathname } from "next/navigation";
import { SiteHomeNav } from "@/components/layout/site-home/site-home-nav";

function isPricingShell(pathname: string): boolean {
  return pathname === "/pricing" || pathname.startsWith("/pricing/");
}

function isMarketingDarkShell(pathname: string): boolean {
  if (pathname === "/") return true;
  if (isPricingShell(pathname)) return false;
  if (pathname.startsWith("/products")) return true;
  if (pathname.startsWith("/courses")) return true;
  return false;
}

export function SiteLayoutShell({
  navAuth,
  pricingNavAuth,
  isLoggedIn,
  children,
}: {
  navAuth: React.ReactNode;
  pricingNavAuth?: React.ReactNode;
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const useFullDarkShell = isMarketingDarkShell(pathname);
  const usePricingShell = isPricingShell(pathname);

  if (usePricingShell) {
    return (
      <div data-site-home className="min-h-screen overflow-x-clip">
        <div className="site-app-shell site-home-page-bg min-h-screen overflow-x-clip">
          <SiteHomeNav variant="account" isLoggedIn={isLoggedIn}>
            {pricingNavAuth ?? navAuth}
          </SiteHomeNav>
          {children}
        </div>
      </div>
    );
  }

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
