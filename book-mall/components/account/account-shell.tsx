"use client";

import Link from "next/link";
import { AccountNavMenu } from "@/components/account/account-nav-menu";
import { AccountMobileNavSlot } from "@/components/account/account-mobile-nav-slot";

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
  appsMenuHint,
  billingPersona,
  children,
}: {
  profile: { image: string | null; name: string | null; phone: string | null };
  isAdmin: boolean;
  showToolsCta: boolean;
  canLaunchTools: boolean;
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
  gatewayLinked: boolean;
  canLaunchEcommerce: boolean;
  ecomOriginConfigured: boolean;
  canLaunchQuickReplica: boolean;
  quickReplicaOriginConfigured: boolean;
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
    appsMenuHint,
    billingPersona,
  };

  return (
    <div className="account-shell-root site-app-shell w-full overflow-x-clip">
      <div className="grid w-full md:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside
          className="site-app-sidebar hidden md:sticky md:top-16 md:block md:max-h-[calc(100dvh-4rem)] md:self-start md:overflow-y-auto md:overscroll-y-contain"
        >
          <div className="account-sidebar-panel px-3 py-4">
            <AccountNavMenu {...menuProps} placement="sidebar" />
          </div>
        </aside>

        <div className="min-w-0">
          <header
            className="site-app-subheader sticky top-16 z-10 flex h-12 items-center gap-3 px-4 md:hidden"
          >
            <AccountMobileNavSlot {...menuProps} />
            <p className="truncate text-sm font-semibold text-[#656d76]">
              <Link href="/account" className="hover:text-[#1f2328]">
                个人中心
              </Link>
            </p>
          </header>
          <main className="site-app-main account-center px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-5xl min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
