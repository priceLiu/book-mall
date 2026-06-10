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
  appsMenuHint,
  billingPersona,
  children,
}: {
  profile: { image: string | null; name: string | null; email: string | null };
  isAdmin: boolean;
  showToolsCta: boolean;
  canLaunchTools: boolean;
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
  gatewayLinked: boolean;
  canLaunchEcommerce: boolean;
  ecomOriginConfigured: boolean;
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
    appsMenuHint,
    billingPersona,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[15.5rem] shrink-0 flex-col border-r border-border bg-card/30 md:sticky md:top-0 md:flex md:h-screen md:max-h-screen">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4">
          <AccountNavMenu {...menuProps} placement="sidebar" />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="truncate text-sm font-medium text-muted-foreground md:hidden">
              <Link href="/account" className="hover:text-foreground">
                个人中心
              </Link>
            </p>
            <p className="hidden truncate text-sm font-medium text-muted-foreground md:block">
              个人中心
            </p>
            <AccountMobileNavSlot {...menuProps} />
          </div>
          <ToggleTheme iconOnly className="shrink-0" />
        </header>
        <main className="account-center min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
