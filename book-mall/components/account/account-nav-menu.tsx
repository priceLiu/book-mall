"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Menu } from "@ark-ui/react/menu";
import { Portal } from "@ark-ui/react/portal";
import { ChevronDown, Menu as MenuIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  openCanvasAppInNewTab,
  openEcomAppInNewTab,
  openToolsAppInNewTab,
} from "@/lib/account-app-launch";
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
  buttonVariants({ variant: "subscription", size: "sm" }),
  "mt-1 h-9 w-full min-w-0 justify-start gap-2 px-3 font-medium focus-visible:ring-offset-background",
);

function isSubscriptionAction(
  item: AccountNavMenuItem,
): item is Extract<AccountNavMenuItem, { kind: "action" }> {
  return item.kind === "action" && item.accent === "subscription";
}
const triggerClass =
  "inline-flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const dropdownContentClass =
  "z-50 min-w-[15rem] rounded-lg border border-border bg-popover p-1 shadow-lg focus-visible:outline-hidden";

type Profile = {
  image: string | null;
  name: string | null;
  email: string | null;
};

type NavRuntimeProps = {
  groups: AccountNavMenuGroup[];
  pathname: string;
  canLaunchTools: boolean;
  canvasReady: boolean;
  ecomReady: boolean;
  onAction: (id: string) => void;
};

function ProfileTrigger({
  profile,
  profileLabel,
  initial,
  open,
}: {
  profile: Profile;
  profileLabel: string;
  initial: string;
  open: boolean;
}) {
  return (
    <>
      <Avatar className="h-9 w-9 shrink-0 border border-border">
        {profile.image ? (
          <AvatarImage src={profile.image} alt="" referrerPolicy="no-referrer" />
        ) : null}
        <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-semibold">{profileLabel}</span>
        {profile.email ? (
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {profile.email}
          </span>
        ) : null}
      </span>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-180",
        )}
        aria-hidden
      />
    </>
  );
}

/** 侧栏常驻导航（不用 Ark Menu，避免 Positioner 撑满视口） */
function AccountSidebarNav({
  groups,
  pathname,
  canLaunchTools,
  canvasReady,
  ecomReady,
  onAction,
  appsMenuHint,
}: NavRuntimeProps & { appsMenuHint: string | null }) {
  function renderLink(item: AccountNavLinkItem) {
    const active = isAccountNavLinkActive(pathname, item.href, item.exact);
    const Icon = item.icon;
    const className = cn(itemClass, active && itemActiveClass);

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
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
      (item.id === "launch-ecom" && !ecomReady);

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
        onClick={() => onAction(item.id)}
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

/** 移动端 Ark 下拉菜单 */
function AccountDropdownNav(props: NavRuntimeProps) {
  const { groups, pathname, canLaunchTools, canvasReady, ecomReady, onAction } = props;

  function renderLink(item: AccountNavLinkItem) {
    const active = isAccountNavLinkActive(pathname, item.href, item.exact);
    const Icon = item.icon;
    const className = cn(itemClass, active && itemActiveClass);
    const inner = (
      <>
        <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <span>{item.label}</span>
      </>
    );

    if (item.external) {
      return (
        <Menu.Item key={item.href} value={item.href} className={className} closeOnSelect={false} asChild>
          <a href={item.href} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        </Menu.Item>
      );
    }

    return (
      <Menu.Item key={item.href} value={item.href} className={className} closeOnSelect={false} asChild>
        <Link href={item.href}>{inner}</Link>
      </Menu.Item>
    );
  }

  function renderItem(item: AccountNavMenuItem) {
    if (item.kind === "link") return renderLink(item);
    const Icon = item.icon;
    const disabled =
      (item.id === "launch-tools" && !canLaunchTools) ||
      (item.id === "launch-canvas" && !canvasReady) ||
      (item.id === "launch-ecom" && !ecomReady);

    const subscriptionAction = isSubscriptionAction(item);

    return (
      <Menu.Item
        key={item.id}
        value={item.id}
        className={cn(
          subscriptionAction ? signOutButtonClass : itemClass,
          disabled && "pointer-events-none opacity-50",
        )}
        closeOnSelect={false}
        onSelect={() => {
          if (disabled) return;
          onAction(item.id);
        }}
      >
        <Icon
          className={cn("h-4 w-4 shrink-0", subscriptionAction ? "opacity-95" : "opacity-70")}
          aria-hidden
        />
        <span>{item.label}</span>
      </Menu.Item>
    );
  }

  return (
    <>
      {groups.map((group, index) => (
        <Menu.ItemGroup key={group.id}>
          <Menu.ItemGroupLabel className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </Menu.ItemGroupLabel>
          {group.items.map((item) => renderItem(item))}
          {index < groups.length - 1 ? <Menu.Separator className={separatorClass} /> : null}
        </Menu.ItemGroup>
      ))}
    </>
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
  appsMenuHint,
  placement = "sidebar",
}: {
  profile: Profile;
  isAdmin: boolean;
  showToolsCta: boolean;
  canLaunchTools: boolean;
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
  gatewayLinked: boolean;
  canLaunchEcommerce: boolean;
  ecomOriginConfigured: boolean;
  appsMenuHint: string | null;
  placement?: "sidebar" | "header";
}) {
  const pathname = usePathname();
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initial = (profile.name?.[0] || profile.email?.[0] || "?").toUpperCase();
  const profileLabel = profile.name?.trim() || profile.email || "我的账户";
  const isSidebar = placement === "sidebar";

  const canvasReady =
    gatewayLinked && canLaunchCanvas && canvasOriginConfigured;
  const ecomReady = canLaunchEcommerce && ecomOriginConfigured;

  const groups = useMemo(
    () =>
      buildAccountNavMenuGroups({
        isAdmin,
        showToolsLaunch: showToolsCta && canLaunchTools,
        showCanvasLaunch: canvasReady,
        showEcomLaunch: ecomReady,
      }),
    [isAdmin, showToolsCta, canLaunchTools, canvasReady, ecomReady],
  );

  async function runAction(id: string) {
    setActionMsg(null);
    if (id === "sign-out") {
      window.location.href = "/api/auth/full-signout?callbackUrl=/";
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
    }
  }

  const navProps: NavRuntimeProps & { appsMenuHint: string | null } = {
    groups,
    pathname,
    canLaunchTools,
    canvasReady,
    ecomReady,
    onAction: (id) => void runAction(id),
    appsMenuHint,
  };

  if (isSidebar) {
    return (
      <div className="min-w-0 w-full overflow-hidden">
        <button
          type="button"
          className={triggerClass}
          aria-expanded={sidebarOpen}
          aria-controls="account-sidebar-nav"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <ProfileTrigger
            profile={profile}
            profileLabel={profileLabel}
            initial={initial}
            open={sidebarOpen}
          />
        </button>
        {sidebarOpen ? (
          <div id="account-sidebar-nav">
            <AccountSidebarNav {...navProps} />
          </div>
        ) : null}
        {actionMsg ? (
          <p className="mt-2 px-1 text-xs text-destructive leading-relaxed">{actionMsg}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="shrink-0">
      <Menu.Root
        open={mobileOpen}
        onOpenChange={(details) => setMobileOpen(details.open)}
        closeOnSelect={false}
      >
        <Menu.Trigger
          className={cn(triggerClass, "h-9 w-auto px-3")}
          aria-label="打开个人中心菜单"
        >
          <MenuIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span>账户菜单</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              mobileOpen && "rotate-180",
            )}
            aria-hidden
          />
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content className={dropdownContentClass}>
              <AccountDropdownNav {...navProps} />
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      {actionMsg ? (
        <p className="mt-2 text-xs text-destructive leading-relaxed">{actionMsg}</p>
      ) : null}
    </div>
  );
}
