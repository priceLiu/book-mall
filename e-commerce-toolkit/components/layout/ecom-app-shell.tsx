"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { EcomAuthBanner } from "@/components/auth/ecom-auth-banner";
import { EcomMobileBar } from "@/components/layout/ecom-mobile-bar";
import { EcomPortalTopBar } from "@/components/layout/ecom-portal-top-bar";
import { EcomProfileSidebar } from "@/components/layout/ecom-profile-sidebar";
import {
  ensureEcomSessionFresh,
  silentEcomSessionRefresh,
} from "@/lib/ecom-silent-sso";
import { setEcomRuntimeBookOrigin } from "@/lib/ecom-runtime-config";
import type { EcomShellUser } from "@/lib/ecom-session.server";

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
  const router = useRouter();
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

  // 冷启动：主站已登录但 ecom 无 token 时，尝试 iframe 静默换票后刷新 SSR 用户态
  React.useEffect(() => {
    if (user) return;
    let cancelled = false;
    void silentEcomSessionRefresh(bookOrigin).then((ok) => {
      if (ok && !cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [user, bookOrigin, router]);

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
