"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
  Search,
} from "lucide-react";
import { navigatePortalLogout } from "@private/federated-portal-logout";
import { buildEcomLoginUrl } from "@/lib/portal-auth-links";
import type { EcomShellUser } from "@/lib/ecom-session.server";
import {
  buildEcomSidebarNavItems,
  type EcomSidebarNavGroup,
  type EcomSidebarNavGroupChild,
  type EcomSidebarNavItem,
  type EcomSidebarNavLink,
} from "@/lib/ecom-sidebar-nav";
import { EcomCreditsBalanceChip } from "@/components/layout/ecom-credits-balance-chip";
import { PlatformTopupNavLink } from "@/lib/platform-billing/platform-topup-nav-link";
import { ecomPrimaryLinkClass } from "@/components/ui/ecom-button";
import { unlockEcomDocumentInteraction } from "@/lib/ecom-document-unlock";
import { feishuGuideUrlForPathname } from "@/lib/ecom-feishu-guide-urls";
import { ECOM_SIDEBAR_LOGO_MARK_CLASS } from "@/lib/ecom-outline-ui";
import { cn } from "@/lib/utils";

const NAV_ACTIVE_SECTION_KEY = "ecom-nav-active-section";
const NAV_MAIN_SCROLL_KEY = "ecom-nav-main-scroll";

const GLASS_DIVIDER = "mx-auto h-px w-8 shrink-0 bg-white/12";

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
  return group.children.some(
    (c) => c.type !== "subheading" && linkIsActive(pathname, c),
  );
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

function normalizeSearch(q: string): string {
  return q.trim().toLowerCase();
}

function linkMatchesSearch(label: string, q: string): boolean {
  if (!q) return true;
  return label.toLowerCase().includes(q);
}

function filterGroupChildren(
  children: EcomSidebarNavGroupChild[],
  q: string,
): EcomSidebarNavGroupChild[] {
  if (!q) return children;
  const out: EcomSidebarNavGroupChild[] = [];
  let pendingSubheading: EcomSidebarNavGroupChild | null = null;
  for (const child of children) {
    if (child.type === "subheading") {
      pendingSubheading = child;
      continue;
    }
    if (linkMatchesSearch(child.label, q)) {
      if (pendingSubheading) {
        out.push(pendingSubheading);
        pendingSubheading = null;
      }
      out.push(child);
    }
  }
  return out;
}

function groupMatchesSearch(group: EcomSidebarNavGroup, q: string): boolean {
  if (!q) return true;
  if (linkMatchesSearch(group.label, q)) return true;
  return group.children.some(
    (c) => c.type !== "subheading" && linkMatchesSearch(c.label, q),
  );
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
      onPointerDown={() => tip?.hide()}
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
      className="pointer-events-none fixed z-[9999] -translate-y-1/2 whitespace-nowrap rounded-full border border-white/15 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-xl backdrop-blur-md"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.label}
    </div>
  );
}

function ExpandedNavLink({
  item,
  active,
  nested,
}: {
  item: EcomSidebarNavLink;
  active: boolean;
  nested?: boolean;
}) {
  const router = useRouter();
  const Icon = item.icon;
  const rowClass = cn(
    "group flex items-center rounded-xl transition-colors",
    nested ? "ml-3 border-l border-white/10 pl-3" : "",
    active
      ? "border border-white/20 bg-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
      : "border border-transparent hover:bg-white/[0.07]",
  );
  const linkClass = cn(
    "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
    active
      ? "text-[var(--ecom-chrome-text)]"
      : "text-[var(--ecom-chrome-text-muted)] group-hover:text-[var(--ecom-chrome-text)]",
  );

  const linkInner = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center opacity-90">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.external ? (
        <ExternalLink className="size-3.5 shrink-0 opacity-50" aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
      )}
    </>
  );

  return (
    <div className={rowClass}>
      {item.external ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {linkInner}
        </a>
      ) : (
        <Link
          href={item.href}
          prefetch
          className={linkClass}
          onPointerDown={() => unlockEcomDocumentInteraction()}
          onClick={(e) => {
            unlockEcomDocumentInteraction();
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            router.push(item.href);
          }}
        >
          {linkInner}
        </Link>
      )}
    </div>
  );
}

function NavGroupAccordion({
  entry,
  pathname,
  open,
  onToggle,
  searchQ,
}: {
  entry: { id: string; group: EcomSidebarNavGroup };
  pathname: string;
  open: boolean;
  onToggle: () => void;
  searchQ: string;
}) {
  const { group } = entry;
  const Icon = group.icon;
  const q = normalizeSearch(searchQ);
  if (!groupMatchesSearch(group, q)) return null;

  const children = filterGroupChildren(group.children, q);
  const sectionActive = groupHasActiveChild(pathname, group);

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm font-medium transition-colors",
          sectionActive && open
            ? "border-white/20 bg-white/[0.09] text-[var(--ecom-chrome-text)]"
            : "border-transparent text-[var(--ecom-chrome-text-muted)] hover:bg-white/[0.07] hover:text-[var(--ecom-chrome-text)]",
        )}
      >
        <Icon className="size-4 shrink-0 opacity-90" />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 opacity-60 transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open ? (
        <div className="space-y-0.5 pb-1 pl-1">
          {children.map((child) =>
            child.type === "subheading" ? (
              <div key={`subheading:${child.label}`} className="px-3 pb-0.5 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ecom-chrome-text-subtle)]">
                  {child.label}
                </p>
              </div>
            ) : (
              <ExpandedNavLink
                key={child.href}
                item={child}
                active={linkIsActive(pathname, child)}
                nested
              />
            ),
          )}
        </div>
      ) : null}
    </div>
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
          "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all",
          active
            ? "bg-white/[0.14] text-[var(--ecom-chrome-text)] ring-1 ring-white/20"
            : "text-[var(--ecom-chrome-text-muted)] hover:bg-white/[0.1] hover:text-[var(--ecom-chrome-text)]",
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
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--ecom-chrome-text-muted)] transition-colors hover:bg-white/[0.1] hover:text-[var(--ecom-chrome-text)]"
      >
        {children}
      </a>
    </RailTooltip>
  );
}

function UserAvatar({ user }: { user: EcomShellUser }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className="size-9 rounded-full object-cover ring-2 ring-white/15"
      />
    );
  }
  const initial = (user.name?.trim() || user.email)?.[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={cn(
        ECOM_SIDEBAR_LOGO_MARK_CLASS,
        "relative size-9 text-sm font-semibold",
      )}
    >
      {initial}
      <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#1c1c1e] bg-emerald-400" />
    </div>
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
  const router = useRouter();
  const mainNavRef = React.useRef<HTMLElement>(null);
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
        (e) =>
          e.kind === "link" &&
          e.link.directOpen &&
          e.link.label === "个人中心",
      ),
    [railEntries],
  );
  const railQuickBottom = React.useMemo(
    () =>
      railEntries.filter(
        (e) =>
          e.kind === "link" &&
          e.link.directOpen &&
          (e.link.label === "使用指南" || e.link.label === "计费与账户"),
      ),
    [railEntries],
  );

  const currentPageGuideUrl = React.useMemo(
    () => feishuGuideUrlForPathname(pathname ?? ""),
    [pathname],
  );

  const inferredId = React.useMemo(
    () => inferSectionId(pathname, railSectionEntries),
    [pathname, railSectionEntries],
  );

  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [openGroupIds, setOpenGroupIds] = React.useState<Set<string>>(() => new Set());
  const searchRef = React.useRef<HTMLInputElement>(null);
  const prevInferredIdRef = React.useRef<string | null>(null);

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

  /** 首屏默认展开当前路由所在分组（或第一个分组）；用户手动收起后不再因 size===0 强行弹开 */
  React.useEffect(() => {
    if (railSectionEntries.length === 0) return;
    setOpenGroupIds((prev) => {
      if (prev.size > 0) return prev;
      const ids = new Set<string>();
      if (inferredId?.startsWith("group:")) ids.add(inferredId);
      else {
        const first = railSectionEntries.find((e) => e.kind === "group");
        if (first) ids.add(first.id);
      }
      return ids;
    });
  }, [inferredId, railSectionEntries]);

  /** 仅当路由推断的分组切换时自动展开，避免与手风琴 toggle 打架 */
  React.useEffect(() => {
    if (!inferredId?.startsWith("group:")) {
      prevInferredIdRef.current = inferredId;
      return;
    }
    if (prevInferredIdRef.current === inferredId) return;
    prevInferredIdRef.current = inferredId;
    setOpenGroupIds((prev) => new Set(prev).add(inferredId));
  }, [inferredId]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (collapsed) onCollapsedChange?.(false);
        e.preventDefault();
        window.setTimeout(() => searchRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, onCollapsedChange]);

  React.useEffect(() => {
    if (collapsed) return;
    const el = mainNavRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(NAV_MAIN_SCROLL_KEY, String(el.scrollTop));
        } catch {
          /* ignore */
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [collapsed]);

  React.useLayoutEffect(() => {
    if (collapsed) return;
    const el = mainNavRef.current;
    if (!el) return;
    try {
      const raw = sessionStorage.getItem(NAV_MAIN_SCROLL_KEY);
      if (!raw) return;
      const top = Number(raw);
      if (!Number.isFinite(top) || top <= 0) return;
      if (el.scrollTop === 0) el.scrollTop = top;
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const resolvedSectionId =
    activeSectionId ??
    inferredId ??
    defaultSectionId(railSectionEntries);

  function signOut() {
    navigatePortalLogout("/api/auth/logout");
  }

  const collapseSidebar = () => onCollapsedChange?.(true);
  const expandSidebar = () => onCollapsedChange?.(false);

  function toggleGroup(id: string) {
    setOpenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRailEntry(entry: RailEntry) {
    if (entry.kind === "link" && entry.link.directOpen) {
      if (entry.link.external) {
        window.open(entry.link.href, "_blank", "noopener,noreferrer");
      } else {
        unlockEcomDocumentInteraction();
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

    if (entry.kind === "group") {
      setOpenGroupIds(new Set([entry.id]));
      if (collapsed) expandSidebar();
      return;
    }

    if (entry.kind === "link") {
      if (entry.link.external) {
        window.open(entry.link.href, "_blank", "noopener,noreferrer");
      } else {
        if (collapsed) expandSidebar();
        unlockEcomDocumentInteraction();
        router.push(entry.link.href);
      }
    }
  }

  function renderRailQuickLink(entry: RailEntry) {
    if (entry.kind !== "link") return null;
    const Icon = entry.link.icon;
    const tooltip =
      entry.link.label === "个人中心"
        ? "个人中心（新标签打开）"
        : entry.link.label === "使用指南"
          ? "使用指南（飞书知识库，新标签打开）"
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
      x: rect.right + 12,
      y: rect.top + rect.height / 2,
    });
  }, []);

  const hideRailTip = React.useCallback(() => setRailTip(null), []);

  /** 收起轨图标卸掉时 mouseleave 不会触发，提示会停在旧坐标 */
  React.useEffect(() => {
    hideRailTip();
  }, [collapsed, pathname, hideRailTip]);

  const railTipApi = React.useMemo(
    () => ({ show: showRailTip, hide: hideRailTip }),
    [showRailTip, hideRailTip],
  );

  const searchQ = normalizeSearch(searchQuery);

  return (
    <RailTipContext.Provider value={railTipApi}>
      <aside
        className={cn(
          "ecom-glass-sidebar pointer-events-auto relative isolate z-[320] flex h-full max-h-full shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 text-zinc-100",
          collapsed ? "w-[4.5rem]" : "w-[21rem]",
          className,
        )}
        aria-label="电商工具箱导航"
        onPointerDown={() => unlockEcomDocumentInteraction()}
        onPointerLeave={hideRailTip}
      >
        {collapsed ? (
          <div className="flex min-h-0 flex-1 flex-col items-center gap-2 py-4">
            {railQuickTop.map(renderRailQuickLink)}

            <RailTooltip label="电商工具箱首页">
              <Link
                href="/"
                prefetch
                className={cn(
                  ECOM_SIDEBAR_LOGO_MARK_CLASS,
                  "size-9 text-sm font-semibold transition hover:scale-105",
                )}
                aria-label="电商工具箱首页"
              >
                商
              </Link>
            </RailTooltip>

            <GlassDivider />

            <RailTooltip label="搜索页面">
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-xl text-[var(--ecom-chrome-text-muted)] transition-colors hover:bg-white/[0.1] hover:text-[var(--ecom-chrome-text)]"
                aria-label="搜索页面"
                onClick={() => {
                  expandSidebar();
                  window.setTimeout(() => searchRef.current?.focus(), 80);
                }}
              >
                <Search className="size-4" />
              </button>
            </RailTooltip>

            <div className="ecom-scrollbar-thin flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
              {railSectionEntries.map((entry) => {
                const active =
                  entry.id === resolvedSectionId ||
                  (entry.kind === "group" &&
                    groupHasActiveChild(pathname ?? "", entry.group));
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

            <GlassDivider />

            {railQuickBottom.map(renderRailQuickLink)}

            {user ? (
              <>
                <div className="px-1">
                  <EcomCreditsBalanceChip collapsed />
                </div>
                <RailTooltip label={user.name}>
                  <div className="pointer-events-none">
                    <UserAvatar user={user} />
                  </div>
                </RailTooltip>
                <RailIconButton title="退出登录" onClick={signOut}>
                  <LogOut className="size-4" />
                </RailIconButton>
              </>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="mb-4 flex items-start gap-3">
              <Link
                href="/"
                prefetch
                className={cn(ECOM_SIDEBAR_LOGO_MARK_CLASS, "size-10 text-sm")}
                aria-label="电商工具箱首页"
              >
                商
              </Link>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-base font-semibold leading-tight text-[var(--ecom-chrome-text)]">
                  电商工具箱
                </p>
                <p className="truncate text-[11px] text-[var(--ecom-chrome-text-subtle)]">
                  E-commerce workspace
                </p>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <Search className="size-4 shrink-0 text-[var(--ecom-chrome-text-subtle)]" />
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索页面"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ecom-chrome-text)] outline-none placeholder:text-[var(--ecom-chrome-text-subtle)]"
                aria-label="搜索导航"
              />
              <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--ecom-chrome-text-subtle)] sm:inline">
                ⌘K
              </kbd>
            </div>

            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ecom-chrome-text-subtle)]">
              主导航
            </p>

            <nav
              ref={mainNavRef}
              className="ecom-scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5"
              role="navigation"
              aria-label="主导航"
            >
              {railSectionEntries.map((entry) => {
                if (entry.kind === "group") {
                  const autoOpen = Boolean(searchQ) && groupMatchesSearch(entry.group, searchQ);
                  const open = openGroupIds.has(entry.id) || autoOpen;
                  return (
                    <NavGroupAccordion
                      key={entry.id}
                      entry={entry}
                      pathname={pathname ?? ""}
                      open={open}
                      onToggle={() => toggleGroup(entry.id)}
                      searchQ={searchQuery}
                    />
                  );
                }
                if (!linkMatchesSearch(entry.link.label, searchQ)) return null;
                return (
                  <ExpandedNavLink
                    key={entry.id}
                    item={entry.link}
                    active={linkIsActive(pathname ?? "", entry.link)}
                  />
                );
              })}
            </nav>

            {currentPageGuideUrl ? (
              <div className="mt-2 shrink-0 border-t border-white/10 pt-3">
                <a
                  href={currentPageGuideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--ecom-chrome-text-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--ecom-chrome-text)]"
                  title="当前工具使用指南（飞书，新标签打开）"
                >
                  <BookOpen className="size-4 shrink-0 opacity-90" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">当前页使用指南</span>
                  <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
                </a>
              </div>
            ) : null}

            <div className="mt-3 shrink-0 space-y-2 border-t border-white/10 pt-3">
              {user ? (
                <>
                  <EcomCreditsBalanceChip />
                  <PlatformTopupNavLink
                    bookOrigin={bookOrigin}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-medium text-[var(--ecom-chrome-text)] transition-colors hover:bg-white/[0.1]"
                  />
                  <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
                    <UserAvatar user={user} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ecom-chrome-text)]">
                        {user.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--ecom-chrome-text-subtle)]">
                        {user.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--ecom-chrome-text-muted)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ecom-chrome-text)]"
                      title="退出登录"
                      aria-label="退出登录"
                    >
                      <LogOut className="size-4" />
                    </button>
                  </div>
                </>
              ) : (
                <a
                  href={buildEcomLoginUrl(pathname || "/")}
                  className={ecomPrimaryLinkClass("sm", "max-w-none")}
                >
                  登录
                </a>
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-1 text-[11px]">
                {[...railQuickTop, ...railQuickBottom].map((entry) => {
                  if (entry.kind !== "link") return null;
                  return (
                    <a
                      key={entry.id}
                      href={entry.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--ecom-chrome-text-subtle)] underline-offset-2 hover:text-[var(--ecom-chrome-text)] hover:underline"
                    >
                      {entry.link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <RailTooltip label={collapsed ? "展开菜单" : "收起菜单"}>
          <button
            type="button"
            onClick={collapsed ? expandSidebar : collapseSidebar}
            className="absolute -right-3 top-1/2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/90 shadow-lg backdrop-blur-md transition hover:bg-white/20"
            aria-label={collapsed ? "展开菜单" : "收起菜单"}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        </RailTooltip>
      </aside>
      <RailTipLayer tip={railTip} />
    </RailTipContext.Provider>
  );
}

function GlassDivider() {
  return <div className={GLASS_DIVIDER} aria-hidden />;
}