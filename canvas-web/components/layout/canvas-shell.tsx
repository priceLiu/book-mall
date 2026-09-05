"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette } from "lucide-react";
import { PortalNav } from "@/components/portal-nav";
import { CanvasShellAuthSlot } from "@/components/layout/canvas-shell-auth-slot";
import { PlatformTopupNavLink } from "@/lib/platform-billing/platform-topup-nav-link";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";
import { CANVAS_NAV_ITEMS, CANVAS_SITE_BRAND_NAME } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function CanvasShell({
  children,
  bookOrigin,
}: {
  children: React.ReactNode;
  bookOrigin: string | null;
}) {
  const pathname = usePathname() || "/";
  const isCanvasEditor = pathname.startsWith("/canvas/");
  const isAdmin = useCanvasAdmin();

  if (isCanvasEditor) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--canvas-bg)]">
      <header
        className="sticky top-0 z-40 shrink-0 border-b border-white/10 bg-[#181818]"
        style={{ height: "var(--canvas-header-h)" }}
      >
        <div className="canvas-page flex h-full items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-white"
          >
            <span className="flex size-8 items-center justify-center rounded-md border border-white/15 bg-gradient-to-br from-[var(--canvas-accent)]/30 to-transparent">
              <Palette className="size-4 text-[var(--canvas-accent)]" strokeWidth={2} />
            </span>
            <span className="canvas-sans hidden text-sm sm:inline">{CANVAS_SITE_BRAND_NAME}</span>
          </Link>

          <nav
            className="flex min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-white/5 px-1 py-0.5 backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 sm:px-1.5 [&::-webkit-scrollbar]:hidden"
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
                    "canvas-sans shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold tracking-tight transition sm:px-3 sm:text-sm",
                    active
                      ? "bg-white/12 text-white ring-1 ring-white/15"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            {isAdmin ? (
              <Link
                href="/admin"
                className={cn(
                  "canvas-sans shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold tracking-tight transition sm:px-3 sm:text-sm",
                  pathname.startsWith("/admin")
                    ? "bg-white/12 text-white ring-1 ring-white/15"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                管理中心
              </Link>
            ) : null}
          </nav>

          <div className="min-w-0 flex-1" aria-hidden />

          {bookOrigin ? (
            <PlatformTopupNavLink
              bookOrigin={bookOrigin}
              className="canvas-sans hidden shrink-0 rounded-full border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white sm:inline-flex"
            />
          ) : null}

          <PortalNav current="canvas" bookOrigin={bookOrigin} />

          <CanvasShellAuthSlot />
        </div>
      </header>

      <main className="canvas-shell-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
