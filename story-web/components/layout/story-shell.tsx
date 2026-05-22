"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { STORY_NAV_ITEMS } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function StoryShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isHome = pathname === "/" || pathname.startsWith("/space/");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--story-bg)]">
      <header
        className={cn(
          "sticky top-0 z-40 border-b backdrop-blur-md",
          isHome ? "border-white/10 bg-[var(--story-bg)]/80" : "border-white/10 bg-[var(--story-surface)]/90",
        )}
      >
        <div className="story-container flex h-14 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
            <span className="flex size-8 items-center justify-center rounded-md border border-white/15 bg-white/5">
              <Clapperboard className="size-4 text-white" strokeWidth={2} />
            </span>
            <span className="story-sans hidden text-sm sm:inline">story-web</span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="空间导航">
            {STORY_NAV_ITEMS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "story-sans rounded-full px-3 py-1.5 text-sm transition",
                    active
                      ? "bg-white/10 font-medium text-white ring-1 ring-white/15"
                      : "text-[var(--story-muted)] hover:text-white",
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
