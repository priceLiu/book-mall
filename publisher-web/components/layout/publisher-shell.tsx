"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

const AUTH_PREFIXES = ["/login", "/register", "/auth/"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export function PublisherShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const bookOrigin = getMainSiteOrigin();

  if (isAuthRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-[var(--pub-ink)]">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--pub-primary)] text-sm text-white">
              发
            </span>
            <span className="hidden text-sm sm:inline">一键发布</span>
          </Link>
          <nav className="flex min-w-0 items-center gap-1 text-sm">
            <Link
              href="/"
              className={`rounded-full px-3 py-1.5 ${pathname === "/" ? "bg-[#f5f5f7] font-medium" : "text-[var(--pub-muted)] hover:bg-[#f5f5f7]"}`}
            >
              首页
            </Link>
            <Link
              href="/publish"
              className={`rounded-full px-3 py-1.5 ${pathname.startsWith("/publish") ? "bg-[#f5f5f7] font-medium" : "text-[var(--pub-muted)] hover:bg-[#f5f5f7]"}`}
            >
              新建发布
            </Link>
            {bookOrigin ? (
              <a
                href={`${bookOrigin}/publisher/download`}
                className="rounded-full px-3 py-1.5 text-[var(--pub-muted)] hover:bg-[#f5f5f7]"
                target="_blank"
                rel="noopener noreferrer"
              >
                下载扩展
              </a>
            ) : null}
          </nav>
          <div className="hidden min-w-0 flex-1 md:flex md:justify-center">
            <PortalNav current="publisher" />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">
            {bookOrigin ? (
              <a
                href={`${bookOrigin}/publisher-open?client=extension&path=/login`}
                className="rounded-full border border-black/10 px-3 py-1.5 text-[var(--pub-muted)] hover:bg-[#f5f5f7]"
                target="_blank"
                rel="noopener noreferrer"
              >
                连接扩展
              </a>
            ) : null}
            <Link href="/login" className="rounded-full bg-[var(--pub-primary)] px-3 py-1.5 text-white">
              登录
            </Link>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
