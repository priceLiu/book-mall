"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, PanelLeftClose } from "lucide-react";
import { buildEcomLoginUrl } from "@/lib/ecom-auth";
import type { EcomShellUser } from "@/lib/ecom-session.server";
import {
  buildEcomSidebarNavItems,
  type EcomSidebarNavGroup,
  type EcomSidebarNavLink,
} from "@/lib/ecom-sidebar-nav";
import { EcomCreditsBalanceChip } from "@/components/layout/ecom-credits-balance-chip";
import { ecomPrimaryLinkClass } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";

function navTargetActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function shouldUseNativeNav(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function navigateSidebarHref(
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string,
) {
  if (shouldUseNativeNav(event)) return;
  event.preventDefault();
  window.location.assign(href);
}

function NavLinkRow({
  item,
  active,
  nested,
}: {
  item: EcomSidebarNavLink;
  active: boolean;
  nested?: boolean;
}) {
  const Icon = item.icon;
  const className = cn(
    "group relative z-[1] flex items-center rounded-md text-sm font-medium transition-colors",
    nested ? "py-2 pl-9 pr-3 text-[13px]" : "px-3 py-2.5",
    active
      ? "bg-[var(--ecom-chrome-hover)] text-[var(--ecom-chrome-text)]"
      : "text-[var(--ecom-chrome-text-muted)] hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]",
  );

  const inner = (
    <>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center opacity-90",
          nested ? "mr-2.5 h-4 w-4" : "mr-3 h-5 w-5",
        )}
      >
        <Icon className="h-full w-full" />
      </span>
      <span className="truncate">{item.label}</span>
      {!nested ? (
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
      ) : null}
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {inner}
      </a>
    );
  }

  return (
    <a
      href={item.href}
      className={className}
      onClick={(event) => navigateSidebarHref(event, item.href)}
    >
      {inner}
    </a>
  );
}

function NavGroupBlock({
  group,
  pathname,
}: {
  group: EcomSidebarNavGroup;
  pathname: string;
}) {
  function childActive(item: EcomSidebarNavLink) {
    if (item.activeAlways) return true;
    return navTargetActive(pathname, item.href);
  }

  const hasActiveChild = group.children.some((c) => childActive(c));
  const [open, setOpen] = React.useState(hasActiveChild);

  React.useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  const GroupIcon = group.icon;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        className={cn(
          "flex w-full items-center rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
          hasActiveChild
            ? "text-[var(--ecom-chrome-text)]"
            : "text-[var(--ecom-chrome-text-muted)] hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]",
        )}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center opacity-90">
          <GroupIcon className="h-full w-full" />
        </span>
        <span className="truncate">{group.label}</span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-[var(--ecom-chrome-text-subtle)] transition-transform duration-150",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {open ? (
        <div className="space-y-0.5 pb-1">
          {group.children.map((child) => (
            <NavLinkRow
              key={child.href}
              item={child}
              active={childActive(child)}
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavRow({
  item,
  active,
  collapsed,
}: {
  item: EcomSidebarNavLink;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const className = cn(
    "group relative z-[1] flex items-center rounded-md text-sm font-medium transition-colors",
    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
    active
      ? "bg-[var(--ecom-chrome-hover)] text-[var(--ecom-chrome-text)]"
      : "text-[var(--ecom-chrome-text-muted)] hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]",
  );

  const inner = collapsed ? (
    <Icon className="h-5 w-5 shrink-0" aria-hidden />
  ) : (
    <>
      <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center opacity-90">
        <Icon className="h-full w-full" />
      </span>
      <span className="truncate">{item.label}</span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
    </>
  );

  const title = collapsed ? item.label : undefined;

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={title}
      >
        {inner}
      </a>
    );
  }

  return (
    <a
      href={item.href}
      className={className}
      title={title}
      onClick={(event) => navigateSidebarHref(event, item.href)}
    >
      {inner}
    </a>
  );
}

export function EcomProfileSidebar({
  user,
  bookOrigin,
  collapsed = false,
  onCollapsedChange,
  className,
}: {
  user: EcomShellUser | null;
  bookOrigin: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}) {
  const pathname = usePathname();
  const navItems = React.useMemo(
    () => buildEcomSidebarNavItems(bookOrigin),
    [bookOrigin],
  );

  function isActive(item: EcomSidebarNavLink) {
    if (item.activeAlways) return true;
    return navTargetActive(pathname, item.href);
  }

  function signOut() {
    if (typeof document !== "undefined") {
      document.cookie = "sso_reenter_suppress=1; Path=/; Max-Age=300; SameSite=Lax";
    }
    window.location.href = `${bookOrigin}/api/auth/full-signout?callbackUrl=${encodeURIComponent("/")}`;
  }

  const collapseNav = () => onCollapsedChange?.(true);
  const expandNav = () => onCollapsedChange?.(false);

  return (
    <aside
      className={cn(
        "pointer-events-auto relative isolate z-[200] flex h-full max-h-full shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-[#141416] text-zinc-100 shadow-lg transition-[width] duration-200 ease-out",
        collapsed ? "w-14 p-2" : "w-[17.5rem] p-4",
        className,
      )}
      aria-label="电商工具箱导航"
    >
      {collapsed ? (
        <div className="relative flex h-full flex-col items-center py-3">
          <button
            type="button"
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0071e3] text-sm font-bold text-white shadow-md transition hover:scale-105"
            title="展开菜单"
            aria-label="展开菜单"
            onClick={expandNav}
          >
            商
          </button>
          {user ? (
            <div className="mt-3 w-full px-1">
              <EcomCreditsBalanceChip collapsed />
            </div>
          ) : null}
          <button
            type="button"
            onClick={expandNav}
            className="absolute -right-px top-1/2 z-10 flex h-10 w-4 -translate-y-1/2 translate-x-full items-center justify-center rounded-r-lg border border-l-0 border-[var(--ecom-chrome-border)] bg-[var(--ecom-chrome-bg)] text-[var(--ecom-chrome-text-muted)] shadow-md transition hover:border-[var(--ecom-chrome-text-muted)] hover:text-[var(--ecom-chrome-text)]"
            title="展开菜单"
            aria-label="展开菜单"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 p-2">
            <Link
              href="/"
              prefetch
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0071e3] text-base font-bold text-white"
              title="电商工具箱"
            >
              商
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold leading-tight">
                {user?.name ?? "未登录"}
              </p>
              <p className="truncate text-sm text-[var(--ecom-chrome-text-muted)]">
                {user?.phone ?? user?.email ?? "请从主站 SSO 登录"}
              </p>
            </div>
            <button
              type="button"
              onClick={collapseNav}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--ecom-chrome-text-muted)] transition-colors hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]"
              title="收起菜单"
              aria-label="收起菜单"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {user ? (
            <div className="px-1 pb-2">
              <EcomCreditsBalanceChip />
            </div>
          ) : null}

          <div className="my-3 border-t border-[var(--ecom-chrome-border-subtle)]" aria-hidden />

          <nav
            className="ecom-scrollbar-thin pointer-events-auto relative z-[1] min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1"
            role="navigation"
          >
            {navItems.map((item, index) => (
              <React.Fragment key={`nav-${index}`}>
                {item.type === "separator" ? <div className="h-4" aria-hidden /> : null}
                {item.type === "link" ? (
                  <NavRow item={item} active={isActive(item)} collapsed={false} />
                ) : null}
                {item.type === "group" ? (
                  <NavGroupBlock group={item} pathname={pathname} />
                ) : null}
              </React.Fragment>
            ))}
          </nav>

          <div className="mt-3 border-t border-[var(--ecom-chrome-border-subtle)] pt-3">
            {!user ? (
              <a
                href={buildEcomLoginUrl(pathname || "/")}
                className={ecomPrimaryLinkClass("sm", "mb-2 max-w-none")}
              >
                登录
              </a>
            ) : null}
            <button
              type="button"
              onClick={signOut}
              className="group flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium text-[#e8847a] transition-colors hover:bg-[#e8847a]/10"
            >
              <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center">
                <LogOut className="h-full w-full" />
              </span>
              <span>退出登录</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
