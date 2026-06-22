"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IconClose, IconMenu } from "@/components/icons";

import { DashboardNav } from "@/components/dashboard-nav";
import { LogoutButton } from "@/components/logout-button";

export type DashboardNavItem = { href: string; label: string };

type DashboardUser = {
  email: string;
  phone?: string | null;
  name: string | null;
  bookRole?: "ADMIN" | "USER";
  billingPersona?: "PLATFORM_CREDIT" | "BYOK" | null;
  platformPoolDelegate?: { canonicalOwnerEmail: string } | null;
};

function SidebarHeader({ user }: { user: DashboardUser }) {
  const isAdmin = user.bookRole === "ADMIN";
  const isByok = user.billingPersona === "BYOK";
  const isPlatformPoolDelegate = Boolean(user.platformPoolDelegate);

  return (
    <div className="border-b border-white/10 px-4 py-5">
      <div className="text-sm font-semibold text-white">Gateway 控制台</div>
      <div className="mt-1 truncate text-xs text-[var(--gw-muted)]">
        {user.name || user.phone || user.email}
      </div>
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
  onNavigate,
}: {
  user: DashboardUser;
  nav: DashboardNavItem[];
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarHeader user={user} />
      <DashboardNav items={nav} onNavigate={onNavigate} />
      <div className="mt-auto p-3">
        <LogoutButton />
      </div>
    </>
  );
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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-[var(--gw-bg)]">
      {/* 桌面端：与原 layout 一致的静态侧栏 */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-[var(--gw-surface)] md:flex md:min-h-screen">
        <SidebarBody user={user} nav={nav} />
      </aside>

      {/* 移动端：抽屉侧栏（不与桌面共用 fixed/static 切换） */}
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
        <SidebarBody user={user} nav={nav} onNavigate={() => setSidebarOpen(false)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
