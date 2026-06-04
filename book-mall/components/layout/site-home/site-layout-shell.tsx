"use client";

import { usePathname } from "next/navigation";
import { SiteHomeNav } from "@/components/layout/site-home/site-home-nav";

export function SiteLayoutShell({
  navAuth,
  isLoggedIn,
  children,
}: {
  navAuth: React.ReactNode;
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const isBlueHome = usePathname() === "/";

  if (isBlueHome) {
    return (
      <div data-site-home className="dark min-h-screen overflow-x-clip">
        <div className="site-home-page-bg min-h-screen overflow-x-clip">
          <SiteHomeNav isLoggedIn={isLoggedIn}>{navAuth}</SiteHomeNav>
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      <div data-site-home-header className="dark">
        <SiteHomeNav isLoggedIn={isLoggedIn}>{navAuth}</SiteHomeNav>
      </div>
      {children}
    </>
  );
}
