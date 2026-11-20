"use client";

import { usePathname } from "next/navigation";

import { SiteLayoutShell } from "@/components/layout/site-home/site-layout-shell";

/** 以客户端 pathname 分流壳层，避免 RSC 误读 header 时在登录页仍套营销顶栏 */
export function SiteLayoutShellGate({
  navAuth,
  v2NavAuth,
  isLoggedIn,
  children,
}: {
  navAuth: React.ReactNode;
  v2NavAuth: React.ReactNode;
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  return (
    <SiteLayoutShell
      pathname={pathname}
      navAuth={navAuth}
      v2NavAuth={v2NavAuth}
      isLoggedIn={isLoggedIn}
    >
      {children}
    </SiteLayoutShell>
  );
}