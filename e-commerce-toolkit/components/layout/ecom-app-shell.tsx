"use client";

import * as React from "react";

import { EcomAuthBanner } from "@/components/auth/ecom-auth-banner";
import { EcomMobileBar } from "@/components/layout/ecom-mobile-bar";
import { EcomPortalTopBar } from "@/components/layout/ecom-portal-top-bar";
import { EcomProfileSidebar } from "@/components/layout/ecom-profile-sidebar";
import { ensureEcomSessionFresh } from "@/lib/ecom-silent-sso";
import type { EcomShellUser } from "@/lib/ecom-session.server";

const NAV_COLLAPSED_KEY = "ecom-nav-collapsed";
/** 心跳间隔：令牌默认 10 分钟，60s 检查可在过期前静默续期 */
const SESSION_HEARTBEAT_MS = 60_000;
/** 令牌剩余不足该秒数时静默续期 */
const SESSION_REFRESH_THRESHOLD_SEC = 180;

export function EcomAppShell({
  user,
  bookOrigin,
  children,
}: {
  user: EcomShellUser | null;
  bookOrigin: string;
  children: React.ReactNode;
}) {
  const [navCollapsed, setNavCollapsed] = React.useState(false);

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

  // 已登录时定时静默续期工具站令牌，避免长时间编辑过程中会话过期掉登录
  const loggedIn = Boolean(user);
  React.useEffect(() => {
    if (!loggedIn) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void ensureEcomSessionFresh(SESSION_REFRESH_THRESHOLD_SEC).catch(() => {});
    };
    const id = window.setInterval(tick, SESSION_HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loggedIn]);

  return (
    <div className="flex h-dvh gap-3 overflow-hidden bg-[#0c0c0e] p-3 md:gap-4 md:p-5">
      <EcomProfileSidebar
        user={user}
        bookOrigin={bookOrigin}
        collapsed={navCollapsed}
        onCollapsedChange={setCollapsed}
        className="hidden h-full md:flex"
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-[var(--ecom-parchment)] shadow-inner">
        <EcomPortalTopBar authed={loggedIn} />
        <EcomMobileBar />
        <EcomAuthBanner />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
