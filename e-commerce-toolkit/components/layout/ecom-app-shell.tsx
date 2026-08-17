"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PlatformAssistant } from "@private/platform-assistant";
import { dispatchEcomCreditsBalanceRefresh } from "@/lib/ecom-credits-balance-events";
import { EcomAuthBanner } from "@/components/auth/ecom-auth-banner";
import { EcomMobileBar } from "@/components/layout/ecom-mobile-bar";
import { EcomProfileSidebar } from "@/components/layout/ecom-profile-sidebar";
import {
  attemptEcomColdStartSso,
  clearEcomSsoReenterAttempts,
  ensureEcomSessionFresh,
} from "@/lib/ecom-silent-sso";
import { setEcomRuntimeBookOrigin } from "@/lib/ecom-runtime-config";
import { unlockEcomDocumentInteraction } from "@/lib/ecom-document-unlock";
import type { EcomShellUser } from "@/lib/ecom-session.server";
import { cn } from "@/lib/utils";

const NAV_COLLAPSED_KEY = "ecom-nav-collapsed";
/** 心跳间隔：令牌默认 10 分钟，60s 检查可在过期前静默续期 */
const SESSION_HEARTBEAT_MS = 60_000;
/** 令牌剩余不足该秒数时静默续期 */
const SESSION_REFRESH_THRESHOLD_SEC = 240;

export function EcomAppShell({
  user,
  bookOrigin,
  children,
}: {
  user: EcomShellUser | null;
  bookOrigin: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navCollapsed, setNavCollapsed] = React.useState(false);

  React.useEffect(() => {
    setEcomRuntimeBookOrigin(bookOrigin);
  }, [bookOrigin]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
      if (raw === "1") setNavCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setCollapsed = React.useCallback((v: boolean) => {
    setNavCollapsed(v);
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const coldStartAttemptedRef = React.useRef(false);

  // 冷启动 / 硬刷新：续签过期 token 或整页 re-enter（与 tool-web 一致，不用 iframe）
  React.useEffect(() => {
    if (user) {
      clearEcomSsoReenterAttempts();
      coldStartAttemptedRef.current = false;
      return;
    }
    if (coldStartAttemptedRef.current) return;
    coldStartAttemptedRef.current = true;
    attemptEcomColdStartSso({ bookOrigin, pathname });
  }, [user, bookOrigin, pathname]);

  React.useEffect(() => {
    const onRefreshed = () => {
      clearEcomSsoReenterAttempts();
      dispatchEcomCreditsBalanceRefresh();
    };
    window.addEventListener("ecom:tools-session-refreshed", onRefreshed);
    return () =>
      window.removeEventListener("ecom:tools-session-refreshed", onRefreshed);
  }, []);

  // 已登录时定时静默续期；失败时不踢到登录页，下一轮心跳再试
  const loggedIn = Boolean(user);
  React.useEffect(() => {
    if (!loggedIn) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void ensureEcomSessionFresh(SESSION_REFRESH_THRESHOLD_SEC, {
        bookOrigin,
        redirectOnFailure: false,
      }).catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, SESSION_HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loggedIn, bookOrigin]);

  React.useEffect(() => {
    unlockEcomDocumentInteraction();
  }, [pathname]);

  React.useEffect(() => {
    return () => {
      unlockEcomDocumentInteraction();
    };
  }, []);

  const sidebarInset = navCollapsed
    ? "md:grid-cols-[4rem_minmax(0,1fr)]"
    : "md:grid-cols-[21rem_minmax(0,1fr)]";

  const collapseNavOnWorkspaceClick = React.useCallback(() => {
    if (!navCollapsed) setCollapsed(true);
  }, [navCollapsed, setCollapsed]);

  return (
    <div className="relative h-dvh overflow-hidden bg-[#0c0c0e] p-3 md:p-5">
      <div
        className={cn(
          "grid h-full min-h-0 grid-cols-1 gap-3 overflow-visible md:gap-4",
          sidebarInset,
        )}
      >
        <EcomProfileSidebar
          user={user}
          bookOrigin={bookOrigin}
          collapsed={navCollapsed}
          onCollapsedChange={setCollapsed}
          className="relative z-[200] hidden h-full max-h-full md:flex"
        />
        <div
          className="relative z-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white shadow-inner"
          onPointerDown={collapseNavOnWorkspaceClick}
        >
          <EcomMobileBar bookOrigin={bookOrigin} />
          <EcomAuthBanner />
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
      <PlatformAssistant title="AI 小智" />
    </div>
  );
}
