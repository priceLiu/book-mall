"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AccountNavMenu } from "@/components/account/account-nav-menu";
import { AccountMobileNavSlot } from "@/components/account/account-mobile-nav-slot";
import { cn } from "@/lib/utils";

const ACCOUNT_SIDEBAR_EXPANDED_W = "15.5rem";

export function AccountShell({
  profile,
  isAdmin,
  showToolsCta,
  canLaunchTools,
  canLaunchCanvas,
  canvasOriginConfigured,
  gatewayLinked,
  canLaunchEcommerce,
  ecomOriginConfigured,
  canLaunchQuickReplica,
  quickReplicaOriginConfigured,
  canLaunchCommonTools,
  commonToolsOriginConfigured,
  publisherOriginConfigured,
  appsMenuHint,
  billingPersona,
  showReferral,
  shellMetaLoading = false,
  children,
}: {
  profile: { image: string | null; name: string | null; phone: string | null };
  isAdmin: boolean;
  showReferral?: boolean;
  shellMetaLoading?: boolean;
  showToolsCta: boolean;
  canLaunchTools: boolean;
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
  gatewayLinked: boolean;
  canLaunchEcommerce: boolean;
  ecomOriginConfigured: boolean;
  canLaunchQuickReplica: boolean;
  quickReplicaOriginConfigured: boolean;
  canLaunchCommonTools: boolean;
  commonToolsOriginConfigured: boolean;
  publisherOriginConfigured: boolean;
  appsMenuHint: string | null;
  billingPersona: import("@prisma/client").BillingPersona | null;
  children: React.ReactNode;
}) {
  const menuProps = {
    profile,
    isAdmin,
    showToolsCta,
    canLaunchTools,
    canLaunchCanvas,
    canvasOriginConfigured,
    gatewayLinked,
    canLaunchEcommerce,
    ecomOriginConfigured,
    canLaunchQuickReplica,
    quickReplicaOriginConfigured,
    canLaunchCommonTools,
    commonToolsOriginConfigured,
    publisherOriginConfigured,
    appsMenuHint,
    billingPersona,
    showReferral,
    shellMetaLoading,
  };

  const pathname = usePathname();
  const isAiSpace = pathname.startsWith("/account/ai-space");
  const [sidebarHover, setSidebarHover] = useState(false);
  const sidebarExpanded = sidebarHover;

  return (
    <div
      className={cn(
        "account-shell-root site-app-shell w-full overflow-x-clip",
        isAiSpace && "account-shell-root--ai-space",
      )}
    >
      <div className="flex w-full">
        <aside
          className={cn(
            "site-app-sidebar relative z-[410] hidden shrink-0 bg-white transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:sticky md:top-14 md:flex md:h-[calc(100dvh-3.5rem)] md:max-h-[calc(100dvh-3.5rem)] md:flex-col md:overflow-hidden md:self-start",
            sidebarExpanded
              ? "w-[15.5rem] shadow-lg shadow-black/5"
              : "account-sidebar-rail w-12",
          )}
          onMouseEnter={() => setSidebarHover(true)}
          onMouseLeave={() => setSidebarHover(false)}
        >
          <div
            className="account-sidebar-panel min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-4"
            style={{ width: ACCOUNT_SIDEBAR_EXPANDED_W }}
            aria-expanded={sidebarExpanded}
          >
            <AccountNavMenu
              {...menuProps}
              placement="sidebar"
              compact={!sidebarExpanded}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1 min-h-0">
          <header className="site-app-subheader sticky top-14 z-10 flex h-12 items-center gap-3 px-4 md:hidden">
            <AccountMobileNavSlot {...menuProps} />
            <p className="truncate text-sm font-semibold text-[#656d76]">
              <Link href="/account" className="hover:text-[#1f2328]">
                个人中心
              </Link>
            </p>
          </header>
          <main
            className={cn(
              "site-app-main account-center min-w-0",
              isAiSpace
                ? "flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col p-0"
                : "px-4 py-4 md:px-8 md:py-6",
            )}
          >
            <div
              className={cn(
                "mx-auto w-full min-w-0",
                !isAiSpace && "max-w-5xl",
                isAiSpace && "flex min-h-0 flex-1 flex-col",
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
