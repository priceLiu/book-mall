"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Palette } from "lucide-react";
import { CANVAS_NAV_ITEMS } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import {
  bookMallLoginHref,
  fetchCanvasViewerUser,
  type CanvasViewerUser,
} from "@/lib/canvas-viewer-session";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";

function ShellAuthSlot() {
  const base = useBookMallBaseUrl();
  const [user, setUser] = useState<CanvasViewerUser | null | undefined>(undefined);

  useEffect(() => {
    if (!base) {
      setUser(null);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 12_000);
    void fetchCanvasViewerUser(base, ac.signal)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => window.clearTimeout(timer));
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [base]);

  if (user === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--canvas-muted)]">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        <span className="hidden sm:inline">登录检查</span>
      </span>
    );
  }

  if (!user) {
    const returnTo = typeof window !== "undefined" ? window.location.href : "/";
    return (
      <a
        href={base ? bookMallLoginHref(base, returnTo) : "#"}
        className="shrink-0 rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 hover:border-amber-400/55"
      >
        登录
      </a>
    );
  }

  return (
    <span className="hidden max-w-[140px] truncate text-[11px] text-[var(--canvas-muted)] md:inline xl:max-w-[200px]">
      {user.name ?? user.email ?? user.id}
      {base ? (
        <>
          {" · "}
          <Link href={`${base}/account`} className="text-[var(--canvas-accent)] hover:underline">
            账户
          </Link>
        </>
      ) : null}
    </span>
  );
}

export function CanvasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isHome = pathname === "/";
  const isCanvasEditor = pathname.startsWith("/canvas/");

  if (isCanvasEditor) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--canvas-bg)]">
      <header
        className={cn(
          "z-40 shrink-0 border-b backdrop-blur-md",
          isHome
            ? "border-white/10 bg-[var(--canvas-bg)]/85"
            : "border-white/10 bg-[var(--canvas-surface)]/90",
        )}
        style={{ height: "var(--canvas-header-h)" }}
      >
        <div className="canvas-page flex h-full items-center justify-between gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-white"
          >
            <span className="flex size-8 items-center justify-center rounded-md border border-white/15 bg-gradient-to-br from-[var(--canvas-accent)]/30 to-transparent">
              <Palette className="size-4 text-[var(--canvas-accent)]" strokeWidth={2} />
            </span>
            <span className="canvas-sans hidden text-sm sm:inline">canvas-web</span>
          </Link>

          <nav
            className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 sm:justify-end sm:overflow-visible [&::-webkit-scrollbar]:hidden"
            aria-label="画布导航"
          >
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
                    "canvas-sans shrink-0 rounded-full px-2.5 py-1.5 text-xs transition sm:px-3 sm:text-sm",
                    active
                      ? "bg-emerald-500/15 font-medium text-emerald-200 ring-1 ring-emerald-400/30"
                      : "text-emerald-300/70 hover:text-emerald-200",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center justify-end pl-1">
            <ShellAuthSlot />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
