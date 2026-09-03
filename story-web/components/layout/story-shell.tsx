"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Loader2 } from "lucide-react";
import { STORY_NAV_ITEMS } from "@/lib/site-config";
import { PortalNav } from "@/components/portal-nav";
import { StoryCreditBalanceChip } from "@/components/platform-credit-balance-chip";
import { useStorySession } from "@/components/auth/story-session-provider";
import { getBookAccountUrl } from "@/lib/site-origin";
import { cn } from "@/lib/utils";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { storyLoginHref, storyRegisterHref } from "@/lib/portal-auth-links";

function shellReturnPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search || "/";
}

function ShellAuthSlot() {
  const base = useBookMallBaseUrl();
  const { loading, active, displayName } = useStorySession();
  const bookAccountUrl = getBookAccountUrl();

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--story-muted)]">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        <span className="hidden sm:inline">登录检查</span>
      </span>
    );
  }

  if (!active) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={storyLoginHref(shellReturnPath(), base)}
          className="twenty-btn-ghost !px-3 !py-1.5 !text-xs"
        >
          登录
        </a>
        <a
          href={storyRegisterHref(shellReturnPath(), base)}
          className="twenty-btn-accent !px-3 !py-1.5 !text-xs"
        >
          注册
        </a>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="hidden max-w-[100px] truncate text-[11px] text-[var(--story-muted)] md:inline xl:max-w-[160px]">
        {displayName ?? "已登录"}
      </span>
      {bookAccountUrl ? (
        <a href={bookAccountUrl} className="twenty-btn-accent !px-3 !py-1.5 !text-xs">
          个人中心
        </a>
      ) : null}
      <a href="/api/auth/logout" className="twenty-btn-ghost !px-3 !py-1.5 !text-xs">
        退出
      </a>
    </div>
  );
}

export function StoryShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isProjectWorkspace = pathname.startsWith("/project/");

  if (isProjectWorkspace) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--story-bg)]">
      <header
        className="sticky top-0 z-40 shrink-0 border-b border-white/10 bg-black/45 backdrop-blur-xl backdrop-saturate-150"
        style={{ height: "var(--story-header-h)" }}
      >
        <div className="story-page flex h-full items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-white"
          >
            <span className="flex size-8 items-center justify-center rounded-md border border-white/15 bg-white/5">
              <Clapperboard className="size-4 text-white" strokeWidth={2} />
            </span>
            <span className="story-sans hidden text-sm sm:inline">story-web</span>
          </Link>

          <nav
            className="flex min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-white/5 px-1 py-0.5 backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 sm:px-1.5 [&::-webkit-scrollbar]:hidden"
            aria-label="空间导航"
          >
            {STORY_NAV_ITEMS.map(({ href, label }) => {
              const active =
                href === "/"
                  ? pathname === "/" || pathname.startsWith("/projects")
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "story-sans shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold tracking-tight transition sm:px-3 sm:text-sm",
                    active
                      ? "bg-white/12 text-white ring-1 ring-white/15"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1" aria-hidden />

          <div className="hidden md:block">
            <PortalNav current="story" />
          </div>

          <StoryCreditBalanceChip />

          <ShellAuthSlot />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
