"use client";

import { navigateBookMallFullSignOut } from "@/lib/session-kicked-marker";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/auth/phone";
import {
  openCanvasAppInNewTab,
  openEcomAppInNewTab,
  openQuickReplicaAppInNewTab,
  openToolsAppInNewTab,
} from "@/lib/account-app-launch";
import { isAccountCanvasLaunchClickable } from "@/lib/account-canvas-launch-clickable";
import {
  buildAccountNavMenuGroups,
  isAccountNavLinkActive,
  type AccountNavLinkItem,
  type AccountNavMenuGroup,
  type AccountNavMenuItem,
} from "@/lib/account-nav-menu-config";

const itemClass =
  "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-hidden";
const itemActiveClass = "bg-muted font-medium";
const separatorClass = "mx-1 my-1 h-px bg-border";
const signOutButtonClass = cn(
  buttonVariants({ variant: "default", size: "sm" }),
  "mt-1 h-9 w-full min-w-0 justify-start gap-2 px-3 font-medium focus-visible:ring-offset-background",
);

function isSubscriptionAction(
  item: AccountNavMenuItem,
): item is Extract<AccountNavMenuItem, { kind: "action" }> {
  return item.kind === "action" && item.accent === "subscription";
}

type Profile = {
  image: string | null;
  name: string | null;
  phone: string | null;
};

type NavRuntimeProps = {
  groups: AccountNavMenuGroup[];
  pathname: string;
  canLaunchTools: boolean;
  canvasReady: boolean;
  ecomReady: boolean;
  quickReplicaReady: boolean;
  onAction: (id: string) => void;
  onNavigate?: () => void;
};

/** 侧栏常驻导航（不用 Ark Menu，避免 Positioner 撑满视口） */
function AccountSidebarNav({
  groups,
  pathname,
  canLaunchTools,
  canvasReady,
  ecomReady,
  quickReplicaReady,
  onAction,
  appsMenuHint,
  onNavigate,
}: NavRuntimeProps & { appsMenuHint: string | null }) {
  function renderLink(item: AccountNavLinkItem) {
    const active = isAccountNavLinkActive(pathname, item.href, item.exact);
    const Icon = item.icon;
    const className = cn(itemClass, active && itemActiveClass);

    if (item.external || item.openInNewTab) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          onClick={() => onNavigate?.()}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{item.label}</span>
        </a>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={className}
        aria-current={active ? "page" : undefined}
        onClick={() => onNavigate?.()}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  function renderItem(item: AccountNavMenuItem) {
    if (item.kind === "link") return renderLink(item);
    const Icon = item.icon;
    const disabled =
      (item.id === "launch-tools" && !canLaunchTools) ||
      (item.id === "launch-canvas" && !canvasReady) ||
      (item.id === "launch-ecom" && !ecomReady) ||
      (item.id === "launch-quick-replica" && !quickReplicaReady);

    const subscriptionAction = isSubscriptionAction(item);

    return (
      <button
        key={item.id}
        type="button"
        className={cn(
          subscriptionAction ? signOutButtonClass : itemClass,
          disabled && "pointer-events-none opacity-50",
        )}
        disabled={disabled}
        onClick={() => {
          onNavigate?.();
          void onAction(item.id);
        }}
      >
        <Icon
          className={cn("h-4 w-4 shrink-0", subscriptionAction ? "opacity-95" : "opacity-70")}
          aria-hidden
        />
        <span className="truncate">{item.label}</span>
      </button>
    );
  }

  const hasAppsGroup = groups.some((g) => g.id === "apps");

  return (
    <nav className="mt-2 min-w-0 w-full" aria-label="个人中心导航">
      {groups.map((group, index) => (
        <div key={group.id} className="min-w-0">
          <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="min-w-0 space-y-0.5">{group.items.map((item) => renderItem(item))}</div>
          {index < groups.length - 1 ? <div className={separatorClass} role="separator" /> : null}
        </div>
      ))}
      {!hasAppsGroup && appsMenuHint ? (
        <p className="mt-3 px-3 text-[11px] leading-relaxed text-muted-foreground">
          {appsMenuHint}
        </p>
      ) : null}
    </nav>
  );
}

export function AccountNavMenu({
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
  placement = "sidebar",
}: {
  profile: Profile;
  isAdmin: boolean;
  billingPersona: import("@prisma/client").BillingPersona | null;
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
  placement?: "sidebar" | "drawer";
}) {
  const pathname = usePathname();
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const initial = (
    profile.name?.[0] ||
    profile.phone?.[0] ||
    "?"
  ).toUpperCase();
  const profileLabel = profile.name?.trim() || "未设置昵称";
  const phoneLabel = profile.phone ? maskPhone(profile.phone) : null;
  const isSidebar = placement === "sidebar";

  const canvasReady = isAccountCanvasLaunchClickable({
    canLaunchCanvas,
    canvasOriginConfigured,
    billingPersona,
    gatewayLinked,
  });
  const ecomReady = canLaunchEcommerce && ecomOriginConfigured;
  const quickReplicaReady = isAccountCanvasLaunchClickable({
    canLaunchCanvas: canLaunchQuickReplica,
    canvasOriginConfigured: quickReplicaOriginConfigured,
    billingPersona,
    gatewayLinked,
  });

  const groups = useMemo(
    () =>
      buildAccountNavMenuGroups({
        isAdmin,
        billingPersona,
        showToolsLaunch: showToolsCta && canLaunchTools,
        showCanvasLaunch: canLaunchCanvas && canvasOriginConfigured,
        showEcomLaunch: ecomReady,
        showQuickReplicaLaunch: canLaunchQuickReplica && quickReplicaOriginConfigured,
      }),
    [
      isAdmin,
      billingPersona,
      showToolsCta,
      canLaunchTools,
      canvasReady,
      ecomReady,
      canLaunchQuickReplica,
      quickReplicaOriginConfigured,
    ],
  );

  async function runAction(id: string) {
    setActionMsg(null);
    if (id === "sign-out") {
      navigateBookMallFullSignOut("/");
      return;
    }
    if (id === "launch-tools") {
      const r = await openToolsAppInNewTab("/fitting-room");
      if (!r.ok) setActionMsg(r.message);
      return;
    }
    if (id === "launch-canvas") {
      openCanvasAppInNewTab("/projects");
      return;
    }
    if (id === "launch-ecom") {
      openEcomAppInNewTab("/");
      return;
    }
    if (id === "launch-quick-replica") {
      openQuickReplicaAppInNewTab("/");
    }
  }

  const navProps: NavRuntimeProps & { appsMenuHint: string | null } = {
    groups,
    pathname,
    canLaunchTools,
    canvasReady,
    ecomReady,
    quickReplicaReady,
    onAction: (id) => void runAction(id),
    onNavigate: () => setMobileOpen(false),
    appsMenuHint,
  };

  if (isSidebar) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-4">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
          <Avatar className="h-9 w-9 shrink-0 border border-border">
            {profile.image ? (
              <AvatarImage src={profile.image} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{profileLabel}</span>
            {phoneLabel ? (
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {phoneLabel}
              </span>
            ) : null}
          </span>
        </div>
        <nav id="account-sidebar-nav" className="min-w-0">
          <AccountSidebarNav {...navProps} />
        </nav>
        {actionMsg ? (
          <p className="px-1 text-xs leading-relaxed text-destructive">{actionMsg}</p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="打开个人中心菜单"
          >
            <MenuIcon className="h-5 w-5" aria-hidden />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[15.5rem] max-w-[85vw] gap-0 p-0">
          <SheetTitle className="sr-only">个人中心菜单</SheetTitle>
          <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
              <Avatar className="h-9 w-9 shrink-0 border border-border">
                {profile.image ? (
                  <AvatarImage src={profile.image} alt="" referrerPolicy="no-referrer" />
                ) : null}
                <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{profileLabel}</span>
                {phoneLabel ? (
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {phoneLabel}
                  </span>
                ) : null}
              </span>
            </div>
            <AccountSidebarNav
              {...navProps}
              onNavigate={() => setMobileOpen(false)}
            />
            {actionMsg ? (
              <p className="mt-3 px-1 text-xs leading-relaxed text-destructive">{actionMsg}</p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
