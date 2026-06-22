"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  badgeKey?: "backgroundWait";
};

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navShortLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= 2) return trimmed;
  return trimmed.slice(0, 2);
}

export function DashboardNav({
  items,
  collapsed,
  navBadges,
  onNavigate,
}: {
  items: NavItem[];
  collapsed?: boolean;
  navBadges?: Partial<Record<"backgroundWait", number>>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className={`flex flex-1 flex-col gap-1 ${collapsed ? "p-2" : "p-3"}`}>
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const badgeCount =
          item.badgeKey && navBadges
            ? navBadges[item.badgeKey] ?? 0
            : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={`rounded-lg text-sm transition ${
              collapsed
                ? "relative flex items-center justify-center px-2 py-2.5 text-xs font-medium"
                : "flex items-center justify-between px-3 py-2"
            } ${
              active
                ? "bg-sky-500/15 font-medium text-sky-200 ring-1 ring-sky-500/30"
                : "text-[var(--gw-muted)] hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>{collapsed ? navShortLabel(item.label) : item.label}</span>
            {badgeCount > 0 ? (
              <span
                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-orange-100 ${
                  collapsed ? "absolute -right-0.5 -top-0.5" : ""
                }`}
                title={`后台等待 ${badgeCount} 条`}
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
