"use client";

import Link from "next/link";
import { AccountNavMenu } from "@/components/account/account-nav-menu";
import { AccountMobileNavSlot } from "@/components/account/account-mobile-nav-slot";
import { ToggleTheme } from "@/components/layout/toogle-theme";

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
    <div className="account-shell-root w-full overflow-x-clip bg-background">
      <div className="grid w-full md:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-card/30 md:sticky md:top-0 md:block md:max-h-screen md:self-start md:overflow-y-auto md:overscroll-y-contain">
          <div className="px-3 py-4">
            <AccountNavMenu {...menuProps} placement="sidebar" />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border bg-background px-4 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <AccountMobileNavSlot {...menuProps} />
              <p className="truncate text-sm font-medium text-muted-foreground">
                <Link href="/account" className="hover:text-foreground">
                  个人中心
                </Link>
              </p>
            </div>
            <ToggleTheme iconOnly className="shrink-0" />
          </header>
          <main className="account-center px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-5xl min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
