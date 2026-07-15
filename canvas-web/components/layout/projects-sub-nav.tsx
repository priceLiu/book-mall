"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CANVAS_PROJECTS_SUB_NAV } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/** 「我的画布」内页 · 居中 tab 导航 */
export function ProjectsSubNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-sm",
        className,
      )}
      aria-label="我的画布子导航"
    >
      <Link
        href="/projects"
        className={cn(
          "rounded-full px-4 py-1.5 text-sm transition-colors",
          pathname === "/projects"
            ? "bg-[var(--canvas-accent)]/20 text-white"
            : "text-[var(--canvas-muted)] hover:text-white",
        )}
      >
        画布列表
      </Link>
      {CANVAS_PROJECTS_SUB_NAV.map((item) => {
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
