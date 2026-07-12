"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Clapperboard, Loader2 } from "lucide-react";
import { STORY_NAV_ITEMS } from "@/lib/site-config";
import { PortalNav } from "@/components/portal-nav";
import { getBookAccountUrl } from "@/lib/site-origin";
import { cn } from "@/lib/utils";
import {
  fetchStoryViewerUser,
  type StoryViewerUser,
} from "@/lib/story-viewer-session";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";

/** 未登录跳本域品牌登录/注册页，保留 redirect 回跳。 */
function localAuthHref(kind: "login" | "register"): string {
  const path =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/";
  return `/${kind}?redirect=${encodeURIComponent(path || "/")}`;
}

function ShellAuthSlot() {
  const base = useBookMallBaseUrl();
  const bookAccountUrl = getBookAccountUrl();
  const [user, setUser] = useState<StoryViewerUser | null | undefined>(undefined);

  useEffect(() => {
    if (!base) {
      setUser(null);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 12_000);
    void fetchStoryViewerUser(base, ac.signal)
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
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--story-muted)]">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        <span className="hidden sm:inline">登录检查</span>
      </span>
    );
  }

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <a href={localAuthHref("login")} className="twenty-btn-ghost !px-3 !py-1.5 !text-xs">
          登录
        </a>
        <a href={localAuthHref("register")} className="twenty-btn-accent !px-3 !py-1.5 !text-xs">
          注册
        </a>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="hidden max-w-[100px] truncate text-[11px] text-[var(--story-muted)] md:inline xl:max-w-[160px]">
        {user.name ?? user.phone ?? user.email ?? user.id}
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
                  ? pathname === "/"
                  : href === "/projects"
                    ? pathname.startsWith("/projects")
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

          <ShellAuthSlot />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
