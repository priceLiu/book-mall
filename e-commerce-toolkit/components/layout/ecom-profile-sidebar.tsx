"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { buildEcomLoginUrl } from "@/lib/ecom-auth";
import type { EcomShellUser } from "@/lib/ecom-session.server";
import {
  buildEcomSidebarNavItems,
  type EcomSidebarNavGroup,
  type EcomSidebarNavItem,
  type EcomSidebarNavLink,
} from "@/lib/ecom-sidebar-nav";
import { EcomCreditsBalanceChip } from "@/components/layout/ecom-credits-balance-chip";
import { ecomPrimaryLinkClass } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";

const NAV_ACTIVE_SECTION_KEY = "ecom-nav-active-section";

type RailEntry =
  | { kind: "group"; id: string; group: EcomSidebarNavGroup }
  | { kind: "link"; id: string; link: EcomSidebarNavLink };

function navTargetActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linkIsActive(pathname: string, item: EcomSidebarNavLink): boolean {
  if (item.activeAlways) return true;
  return navTargetActive(pathname, item.href);
}

function groupHasActiveChild(pathname: string, group: EcomSidebarNavGroup): boolean {
  return group.children.some((c) => linkIsActive(pathname, c));
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

function buildRailEntries(navItems: EcomSidebarNavItem[]): RailEntry[] {
  const entries: RailEntry[] = [];
  for (const item of navItems) {
    if (item.type === "group") {
      entries.push({ kind: "group", id: `group:${item.label}`, group: item });
    } else if (item.type === "link") {
      entries.push({ kind: "link", id: `link:${item.href}`, link: item });
    }
  }
  return entries;
}

function isRailSectionEntry(entry: RailEntry): boolean {
  if (entry.kind === "group") return true;
  if (entry.kind === "link" && !entry.link.directOpen) return true;
  return false;
}

function defaultSectionId(entries: RailEntry[]): string | null {
  const group = entries.find((e) => e.kind === "group");
  if (group) return group.id;
  const internal = entries.find((e) => e.kind === "link" && !e.link.directOpen);
  return internal?.id ?? null;
}

function inferSectionId(pathname: string, entries: RailEntry[]): string | null {
  for (const entry of entries) {
    if (entry.kind === "group" && groupHasActiveChild(pathname, entry.group)) {
      return entry.id;
    }
    if (entry.kind === "link") {
      if (entry.link.directOpen) continue;
      if (linkIsActive(pathname, entry.link)) return entry.id;
    }
  }
  return null;
}

type RailTipState = { label: string; x: number; y: number } | null;

const RailTipContext = React.createContext<{
  show: (label: string, el: HTMLElement) => void;
  hide: () => void;
} | null>(null);

function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const tip = React.useContext(RailTipContext);

  return (
    <div
      className="flex items-center justify-center"
      onMouseEnter={(e) => tip?.show(label, e.currentTarget)}
      onMouseLeave={() => tip?.hide()}
      onFocus={(e) => tip?.show(label, e.currentTarget)}
      onBlur={() => tip?.hide()}
    >
      {children}
    </div>
  );
}

function RailTipLayer({ tip }: { tip: RailTipState }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[9999] -translate-y-1/2 whitespace-nowrap rounded-md border border-zinc-600/80 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-100 shadow-xl"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.label}
    </div>
  );
}

function DetailNavLink({
  item,
  active,
}: {
  item: EcomSidebarNavLink;
  active: boolean;
}) {
  const Icon = item.icon;
  const className = cn(
    "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "bg-[var(--ecom-chrome-hover)] text-[var(--ecom-chrome-text)]"
      : "text-[var(--ecom-chrome-text-muted)] hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]",
  );

  const inner = (
    <>
      <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center opacity-90">
        <Icon className="h-full w-full" />
      </span>
      <span className="truncate">{item.label}</span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
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

function RailIconButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <RailTooltip label={title}>
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-[var(--ecom-chrome-hover)] text-[var(--ecom-chrome-text)]"
            : "text-[var(--ecom-chrome-text-muted)] hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]",
        )}
      >
        {children}
      </button>
    </RailTooltip>
  );
}

function RailExternalLink({
  href,
  title,
  tooltip,
  children,
}: {
  href: string;
  title: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <RailTooltip label={tooltip ?? title}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={title}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--ecom-chrome-text-muted)] transition-colors hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]"
      >
        {children}
      </a>
    </RailTooltip>
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
  const railEntries = React.useMemo(() => buildRailEntries(navItems), [navItems]);
  const railSectionEntries = React.useMemo(
    () => railEntries.filter(isRailSectionEntry),
    [railEntries],
  );
  const railQuickTop = React.useMemo(
    () =>
      railEntries.filter(
        (e) => e.kind === "link" && e.link.directOpen && e.link.label === "个人中心",
      ),
    [railEntries],
  );
  const railQuickBottom = React.useMemo(
    () =>
      railEntries.filter(
        (e) => e.kind === "link" && e.link.directOpen && e.link.label === "计费与账户",
      ),
    [railEntries],
  );

  const inferredId = React.useMemo(
    () => inferSectionId(pathname, railSectionEntries),
    [pathname, railSectionEntries],
  );

  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (inferredId) {
      setActiveSectionId(inferredId);
      try {
        localStorage.setItem(NAV_ACTIVE_SECTION_KEY, inferredId);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const stored = localStorage.getItem(NAV_ACTIVE_SECTION_KEY);
      if (
        stored &&
        railSectionEntries.some((e) => e.id === stored && isRailSectionEntry(e))
      ) {
        setActiveSectionId(stored);
      }
    } catch {
      /* ignore */
    }
  }, [inferredId, railSectionEntries]);

  const resolvedSectionId =
    activeSectionId ??
    inferredId ??
    defaultSectionId(railSectionEntries);

  const activeEntry = railSectionEntries.find((e) => e.id === resolvedSectionId);

  const detailTitle =
    activeEntry?.kind === "group"
      ? activeEntry.group.label
      : activeEntry?.kind === "link"
        ? activeEntry.link.label
        : "导航";

  const detailLinks: EcomSidebarNavLink[] =
    activeEntry?.kind === "group"
      ? activeEntry.group.children
      : activeEntry?.kind === "link"
        ? [activeEntry.link]
        : [];

  function signOut() {
    if (typeof document !== "undefined") {
      document.cookie = "sso_reenter_suppress=1; Path=/; Max-Age=300; SameSite=Lax";
    }
    window.location.href = `${bookOrigin}/api/auth/full-signout?callbackUrl=${encodeURIComponent("/")}`;
  }

  const collapseDetail = () => onCollapsedChange?.(true);
  const expandDetail = () => onCollapsedChange?.(false);

  function selectRailEntry(entry: RailEntry) {
    if (entry.kind === "link" && entry.link.directOpen) {
      if (entry.link.external) {
        window.open(entry.link.href, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(entry.link.href);
      }
      return;
    }

    setActiveSectionId(entry.id);
    try {
      localStorage.setItem(NAV_ACTIVE_SECTION_KEY, entry.id);
    } catch {
      /* ignore */
    }
    if (entry.kind === "link") {
      if (entry.link.external) {
        window.open(entry.link.href, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(entry.link.href);
      }
      return;
    }
    expandDetail();
  }

  function renderRailQuickLink(entry: RailEntry) {
    if (entry.kind !== "link") return null;
    const Icon = entry.link.icon;
    const tooltip =
      entry.link.label === "个人中心"
        ? "个人中心（新标签打开）"
        : entry.link.label === "计费与账户"
          ? "计费与账户（新标签打开）"
          : entry.link.label;
    return (
      <RailExternalLink
        key={entry.id}
        href={entry.link.href}
        title={entry.link.label}
        tooltip={tooltip}
      >
        <Icon className="size-4" />
      </RailExternalLink>
    );
  }

  const [railTip, setRailTip] = React.useState<RailTipState>(null);

  const showRailTip = React.useCallback((label: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setRailTip({
      label,
      x: rect.right + 10,
      y: rect.top + rect.height / 2,
    });
  }, []);

  const hideRailTip = React.useCallback(() => setRailTip(null), []);

  const railTipApi = React.useMemo(
    () => ({ show: showRailTip, hide: hideRailTip }),
    [showRailTip, hideRailTip],
  );

  return (
    <RailTipContext.Provider value={railTipApi}>
      <aside
      className={cn(
        "pointer-events-auto relative isolate z-[200] flex h-full max-h-full shrink-0 flex-row overflow-visible rounded-xl border border-zinc-800/80 bg-[#141416] text-zinc-100 shadow-lg transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[21rem]",
        className,
      )}
      aria-label="电商工具箱导航"
    >
      {/* 左侧图标轨 */}
      <div className="flex w-16 shrink-0 flex-col items-center gap-2 overflow-visible border-r border-[var(--ecom-chrome-border-subtle)] py-3">
        <RailTooltip label="电商工具箱首页">
          <Link
            href="/"
            prefetch
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0071e3] text-sm font-bold text-white shadow-md transition hover:scale-105"
            aria-label="电商工具箱首页"
          >
            商
          </Link>
        </RailTooltip>

        {railQuickTop.map(renderRailQuickLink)}

        <div className="ecom-scrollbar-thin flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
          {railSectionEntries.map((entry) => {
            const active = entry.id === resolvedSectionId;
            if (entry.kind === "group") {
              const Icon = entry.group.icon;
              return (
                <RailIconButton
                  key={entry.id}
                  active={active}
                  title={entry.group.label}
                  onClick={() => selectRailEntry(entry)}
                >
                  <Icon className="size-4" />
                </RailIconButton>
              );
            }
            const Icon = entry.link.icon;
            return (
              <RailIconButton
                key={entry.id}
                active={active}
                title={entry.link.label}
                onClick={() => selectRailEntry(entry)}
              >
                <Icon className="size-4" />
              </RailIconButton>
            );
          })}
        </div>

        {railQuickBottom.map(renderRailQuickLink)}

        {user ? (
          <div className="px-1">
            <EcomCreditsBalanceChip collapsed />
          </div>
        ) : null}
      </div>

      {/* 右侧详情面板 */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[width,opacity] duration-200 ease-out",
          collapsed ? "w-0 opacity-0 pointer-events-none" : "w-[17rem] opacity-100",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold leading-tight text-[var(--ecom-chrome-text)]">
                {detailTitle}
              </p>
              <p className="truncate text-xs text-[var(--ecom-chrome-text-muted)]">
                {user?.name ?? "未登录"}
              </p>
            </div>
            <button
              type="button"
              onClick={collapseDetail}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--ecom-chrome-text-muted)] transition-colors hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]"
              title="收起子菜单"
              aria-label="收起子菜单"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          {user ? (
            <div className="mb-3">
              <EcomCreditsBalanceChip />
            </div>
          ) : null}

          <nav
            className="ecom-scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1"
            role="navigation"
            aria-label={detailTitle}
          >
            {detailLinks.map((link) => (
              <DetailNavLink
                key={link.href}
                item={link}
                active={linkIsActive(pathname, link)}
              />
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
              className="group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-[#e8847a] transition-colors hover:bg-[#e8847a]/10"
            >
              <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center">
                <LogOut className="h-full w-full" />
              </span>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>

      {/* 折叠后展开把手 */}
      {collapsed ? (
        <RailTooltip label="展开子菜单">
          <button
            type="button"
            onClick={expandDetail}
            className="absolute -right-px top-1/2 z-10 flex h-10 w-4 -translate-y-1/2 translate-x-full items-center justify-center rounded-r-lg border border-l-0 border-[var(--ecom-chrome-border)] bg-[#141416] text-[var(--ecom-chrome-text-muted)] shadow-md transition hover:border-[var(--ecom-chrome-text-muted)] hover:text-[var(--ecom-chrome-text)]"
            aria-label="展开子菜单"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </RailTooltip>
      ) : null}
      </aside>
      <RailTipLayer tip={railTip} />
    </RailTipContext.Provider>
  );
}
