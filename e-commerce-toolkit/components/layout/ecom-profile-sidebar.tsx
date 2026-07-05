"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { buildEcomLoginUrl } from "@/lib/ecom-auth";
import type { EcomShellUser } from "@/lib/ecom-session.server";
import {
  buildEcomSidebarNavItems,
  type EcomSidebarNavItem,
} from "@/lib/ecom-sidebar-nav";
import { ecomPrimaryLinkClass } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";

const sidebarVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: EcomSidebarNavItem & { href: string; label: string; icon: LucideIcon };
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const className = cn(
    "group flex items-center rounded-md text-sm font-medium transition-colors",
    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
    active
      ? "bg-white/10 text-white"
      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
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
      <motion.a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        variants={itemVariants}
        className={className}
        title={title}
        onClick={onNavigate}
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.div variants={itemVariants}>
      <Link
        href={item.href}
        className={className}
        title={title}
        onClick={onNavigate}
      >
        {inner}
      </Link>
    </motion.div>
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

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
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
    <motion.aside
      className={cn(
        "relative flex h-full max-h-full shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-[#141416] text-zinc-100 shadow-lg transition-[width] duration-300 ease-out",
        collapsed ? "w-14 p-2" : "w-[17.5rem] p-4",
        className,
      )}
      initial="hidden"
      animate="visible"
      variants={sidebarVariants}
      aria-label="电商工具箱导航"
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0071e3] text-sm font-bold text-white shadow-md transition-transform hover:scale-105"
            title="展开菜单"
            aria-label="展开菜单"
            onClick={expandNav}
          >
            商
          </button>
          <button
            type="button"
            onClick={expandNav}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            title="展开菜单"
            aria-label="展开菜单"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="flex items-center gap-3 p-2">
            <Link
              href="/"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0071e3] text-base font-bold text-white"
              title="电商工具箱"
              onClick={collapseNav}
            >
              商
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold leading-tight">
                {user?.name ?? "未登录"}
              </p>
              <p className="truncate text-sm text-zinc-500">
                {user?.phone ?? user?.email ?? "请从主站 SSO 登录"}
              </p>
            </div>
            <button
              type="button"
              onClick={collapseNav}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
              title="收起菜单"
              aria-label="收起菜单"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="my-3 border-t border-zinc-800"
            aria-hidden
          />

          <nav
            className="ecom-scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1"
            role="navigation"
          >
            {navItems.map((item, index) => (
              <React.Fragment key={`nav-${index}`}>
                {item.isSeparator ? (
                  <motion.div variants={itemVariants} className="h-4" aria-hidden />
                ) : null}
                {item.href && item.label && item.icon ? (
                  <NavRow
                    item={
                      item as EcomSidebarNavItem & {
                        href: string;
                        label: string;
                        icon: LucideIcon;
                      }
                    }
                    active={isActive(item.href)}
                    collapsed={false}
                    onNavigate={collapseNav}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </nav>

          <motion.div variants={itemVariants} className="mt-3 border-t border-zinc-800 pt-3">
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
          </motion.div>
        </>
      )}

    </motion.aside>
  );
}
