"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CANVAS_ADMIN_SUB_NAV } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/** 管理中心 · tab 子导航 */
export function AdminSubNav({
  className,
  align = "center",
}: {
  className?: string;
  align?: "center" | "start";
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-sm",
        align === "center" ? "justify-center" : "justify-start",
        className,
      )}
      aria-label="管理中心子导航"
    >
      {CANVAS_ADMIN_SUB_NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              active
                ? "bg-[var(--canvas-accent)]/20 text-white"
                : "text-[var(--canvas-muted)] hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 判断 pathname 是否命中任一 admin 子路由 */
export function isCanvasAdminSubNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
