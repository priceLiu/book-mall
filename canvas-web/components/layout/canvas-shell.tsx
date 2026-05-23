"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette } from "lucide-react";
import { CANVAS_NAV_ITEMS } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function CanvasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isHome = pathname === "/";
  const isCanvasEditor = pathname.startsWith("/canvas/");

  if (isCanvasEditor) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas-bg)]">
      <header
        className={cn(
          "sticky top-0 z-40 border-b backdrop-blur-md",
          isHome
            ? "border-white/10 bg-[var(--canvas-bg)]/80"
            : "border-white/10 bg-[var(--canvas-surface)]/90",
        )}
      >
        <div className="canvas-container flex h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-white"
          >
            <span className="flex size-8 items-center justify-center rounded-md border border-white/15 bg-gradient-to-br from-[var(--canvas-accent)]/30 to-transparent">
              <Palette className="size-4 text-[var(--canvas-accent)]" strokeWidth={2} />
            </span>
            <span className="canvas-sans hidden text-sm sm:inline">canvas-web</span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="画布导航">
            {CANVAS_NAV_ITEMS.map(({ href, label }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "canvas-sans rounded-full px-3 py-1.5 text-sm transition",
                    active
                      ? "bg-white/10 font-medium text-white ring-1 ring-white/15"
                      : "text-[var(--canvas-muted)] hover:text-white",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
