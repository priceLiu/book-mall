"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  IconClose,
  IconMenu,
  IconSidebarCollapse,
  IconSidebarExpand,
} from "@/components/icons";

import { DashboardNav } from "@/components/dashboard-nav";
import { LogoutButton } from "@/components/logout-button";

export type DashboardNavItem = {
  href: string;
  label: string;
  badgeKey?: "backgroundWait";
};

type DashboardUser = {
  email: string;
  phone?: string | null;
  name: string | null;
  bookRole?: "ADMIN" | "USER";
  billingPersona?: "PLATFORM_CREDIT" | "BYOK" | null;
  platformPoolDelegate?: { canonicalOwnerEmail: string } | null;
};

const SIDEBAR_COLLAPSED_KEY = "gw-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function SidebarHeader({
  user,
  collapsed,
}: {
  user: DashboardUser;
  collapsed?: boolean;
}) {
  const isAdmin = user.bookRole === "ADMIN";
  const isByok = user.billingPersona === "BYOK";
  const isPlatformPoolDelegate = Boolean(user.platformPoolDelegate);
  const displayName = user.name || user.phone || user.email;
  const initial = (displayName.trim()[0] ?? "G").toUpperCase();

  if (collapsed) {
    return (
      <div className="flex flex-col items-center border-b border-white/10 px-2 py-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20 text-sm font-semibold text-sky-200"
          title={displayName}
        >
          {initial}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-white/10 px-4 py-5">
      <div className="text-sm font-semibold text-white">Gateway 控制台</div>
      <div className="mt-1 truncate text-xs text-[var(--gw-muted)]">{displayName}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            isAdmin
              ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
              : "border-white/15 bg-white/5 text-zinc-400"
          }`}
        >
          {isAdmin ? "Admin" : "User"}
        </span>
        <span className="inline-block rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
          {isByok ? "BYOK" : "平台代付"}
        </span>
        {isPlatformPoolDelegate ? (
          <span className="inline-block rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200">
            平台池
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SidebarBody({
  user,
  nav,
  collapsed,
  navBadges,
  onNavigate,
  onToggleCollapse,
}: {
  user: DashboardUser;
  nav: DashboardNavItem[];
  collapsed?: boolean;
  navBadges?: Partial<Record<"backgroundWait", number>>;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      <SidebarHeader user={user} collapsed={collapsed} />
      <DashboardNav
        items={nav}
        collapsed={collapsed}
        navBadges={navBadges}
        onNavigate={onNavigate}
      />
      <div className={`mt-auto space-y-2 ${collapsed ? "px-2 py-2" : "p-3"}`}>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex w-full items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white ${
              collapsed ? "justify-center p-2" : "gap-2 px-3 py-2 text-xs"
            }`}
            title={collapsed ? "展开侧栏" : "收起侧栏"}
            aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
          >
            {collapsed ? (
              <IconSidebarExpand className="h-5 w-5" />
            ) : (
              <>
                <IconSidebarCollapse className="h-4 w-4 shrink-0" />
                <span>收起侧栏</span>
              </>
            )}
          </button>
        ) : null}
        <LogoutButton collapsed={collapsed} />
      </div>
    </>
  );
}

const NAV_BADGE_POLL_MS = 30_000;

function useGatewayNavBadges() {
  const [badges, setBadges] = useState<Partial<Record<"backgroundWait", number>>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          "/api/book-mall/api/gateway/logs/stats?parts=summary&hours=6&scope=all",
        );
        const body = (await res.json().catch(() => null)) as {
          cards?: { backgroundWait?: number };
        } | null;
        if (cancelled || !res.ok || !body?.cards) return;
        setBadges({
          backgroundWait: body.cards.backgroundWait ?? 0,
        });
      } catch {
        /* ignore */
      }
    }

    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, NAV_BADGE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return badges;
}

export function DashboardShell({
  user,
  nav,
  children,
}: {
  user: DashboardUser;
  nav: DashboardNavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navBadges = useGatewayNavBadges();

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsed());
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next);
      return next;
    });
  }

  const desktopAsideWidth = sidebarCollapsed ? "md:w-14" : "md:w-56";
  const isLogsPage = pathname === "/dashboard/logs";

  return (
    <div className="flex h-dvh min-h-screen overflow-hidden bg-[var(--gw-bg)]">
      {/* 桌面端：可收缩静态侧栏 */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-white/10 bg-[var(--gw-surface)] transition-[width] duration-200 md:flex md:min-h-screen ${desktopAsideWidth}`}
      >
        <SidebarBody
          user={user}
          nav={nav}
          collapsed={sidebarCollapsed}
          navBadges={navBadges}
          onToggleCollapse={toggleSidebarCollapsed}
        />
      </aside>

      {/* 移动端：抽屉侧栏 */}
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="关闭菜单"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        aria-hidden={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-white/10 bg-[var(--gw-surface)] transition-transform duration-200 md:hidden ${
          sidebarOpen
            ? "translate-x-0"
            : "pointer-events-none -translate-x-full"
        }`}
      >
        <div className="flex items-center justify-end border-b border-white/10 px-3 py-2">
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="关闭菜单"
            onClick={() => setSidebarOpen(false)}
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <SidebarBody
          user={user}
          nav={nav}
          navBadges={navBadges}
          onNavigate={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-[var(--gw-surface)] px-4 md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-300 hover:bg-white/5 hover:text-white"
            aria-label="打开菜单"
            onClick={() => setSidebarOpen(true)}
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-medium text-white">Gateway 控制台</span>
        </header>
        <main
          className={
            isLogsPage
              ? "flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6"
              : "min-h-0 flex-1 overflow-auto p-4 md:p-6"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
