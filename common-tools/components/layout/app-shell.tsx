"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navigatePortalLogout } from "@private/federated-portal-logout";

import {
  attemptColdStartSso,
  clearSsoReenterAttempts,
  ensureSessionFresh,
  isCommonToolsPublicBrowsePath,
} from "@/lib/silent-sso";
import { PortalNav } from "@/components/portal-nav";
import { setRuntimeBookOrigin } from "@/lib/auth";
import type { ShellUser } from "@/lib/session.server";

const SESSION_HEARTBEAT_MS = 60_000;
const SESSION_REFRESH_THRESHOLD_SEC = 240;

export function AppShell({
  user,
  bookOrigin,
  children,
}: {
  user: ShellUser | null;
  bookOrigin: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const coldStartAttemptedRef = React.useRef(false);

  React.useEffect(() => {
    setRuntimeBookOrigin(bookOrigin);
  }, [bookOrigin]);

  React.useEffect(() => {
    if (user) {
      clearSsoReenterAttempts();
      coldStartAttemptedRef.current = false;
      return;
    }
    if (coldStartAttemptedRef.current) return;
    if (isCommonToolsPublicBrowsePath(pathname)) return;
    coldStartAttemptedRef.current = true;
    attemptColdStartSso({ bookOrigin, pathname });
  }, [user, bookOrigin, pathname]);

  React.useEffect(() => {
    const onRefreshed = () => {
      clearSsoReenterAttempts();
      router.refresh();
    };
    window.addEventListener("common-tools:session-refreshed", onRefreshed);
    return () =>
      window.removeEventListener("common-tools:session-refreshed", onRefreshed);
  }, [router]);

  const loggedIn = Boolean(user);
  React.useEffect(() => {
    if (!loggedIn) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void ensureSessionFresh(SESSION_REFRESH_THRESHOLD_SEC, {
        bookOrigin,
        redirectOnFailure: false,
      }).catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, SESSION_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [loggedIn, bookOrigin]);

  const accountUrl = `${bookOrigin.replace(/\/$/, "")}/account`;
  const pricingUrl = `${bookOrigin.replace(/\/$/, "")}/pricing`;

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
      <header className="sticky top-0 z-40 border-b border-[#e5e5ea] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0">
          <div className="flex h-12 items-center justify-between gap-4 sm:h-14 sm:justify-start">
            <Link href="/" className="text-base font-semibold text-[#1d1d1f]">
              常用工具
            </Link>
            <div className="flex items-center gap-3 text-sm sm:hidden">
              <a
                href={pricingUrl}
                className="text-[#0071e3] hover:underline"
              >
                充值
              </a>
              {user ? (
                <button
                  type="button"
                  className="text-[#6e6e73] hover:text-[#1d1d1f]"
                  onClick={() => navigatePortalLogout("/api/auth/logout")}
                >
                  退出
                </button>
              ) : null}
            </div>
          </div>
          <PortalNav current="common-tools" />
          <div className="hidden items-center gap-3 text-sm sm:flex">
            <a
              href={pricingUrl}
              className="text-[#0071e3] hover:underline"
            >
              会员与充值
            </a>
            {user ? (
              <>
                <a href={accountUrl} className="text-[#1d1d1f] hover:text-[#0071e3]">
                  {user.name}
                </a>
                <button
                  type="button"
                  className="text-[#6e6e73] hover:text-[#1d1d1f]"
                  onClick={() => navigatePortalLogout("/api/auth/logout")}
                >
                  退出
                </button>
              </>
            ) : (
              <Link href="/login" className="text-[#0071e3] hover:underline">
                登录
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-[#e5e5ea] bg-white py-4 text-center text-xs text-[#6e6e73]">
        注册送体验积分，全站 AI 工具通用；持续使用需开通会员或充值，按次消耗积分。赠送积分数量有限，30
        天有效。
      </footer>
    </div>
  );
}
