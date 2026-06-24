"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  resolveGatewayDashboardNav,
  type GatewayDashboardUser,
} from "@/lib/gateway-dashboard-nav";
import {
  gatewayTransientRetryDelayMs,
  isGatewayTransientFetchError,
  sleepMs,
} from "@/lib/gateway-db-retry";

type SessionResponse = { user: GatewayDashboardUser | null };

function ConnectingShell({ longWait }: { longWait: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--gw-bg)] p-6">
      <div className="max-w-sm text-center">
        <div
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--gw-border)] border-t-[var(--gw-accent)]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--gw-ink)]">正在连接服务…</p>
        <p className="mt-2 text-xs text-[var(--gw-muted)]">
          {longWait
            ? "连接较慢，正在自动重试，无需刷新页面"
            : "请稍候，连接恢复后将自动进入控制台"}
        </p>
      </div>
    </main>
  );
}

/**
 * 主站 DB 瞬时不可用时自动重连 session，不向用户展示运维指令。
 */
export function GatewayReconnectGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<GatewayDashboardUser | null>(null);
  const [longWait, setLongWait] = useState(false);
  const attemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        try {
          const res = await fetch("/api/book-mall/api/gateway/auth/session", {
            credentials: "include",
          });
          const raw = await res.text();
          if (isGatewayTransientFetchError(res.status, raw)) {
            attemptRef.current += 1;
            if (attemptRef.current >= 4) setLongWait(true);
            await sleepMs(gatewayTransientRetryDelayMs(attemptRef.current));
            continue;
          }
          if (!res.ok) {
            window.location.href = "/login";
            return;
          }
          let data: SessionResponse | null = null;
          try {
            data = raw ? (JSON.parse(raw) as SessionResponse) : null;
          } catch {
            data = null;
          }
          if (!data?.user) {
            window.location.href = "/login";
            return;
          }
          setUser(data.user);
          return;
        } catch {
          attemptRef.current += 1;
          if (attemptRef.current >= 4) setLongWait(true);
          await sleepMs(gatewayTransientRetryDelayMs(attemptRef.current));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (user) {
    return (
      <DashboardShell user={user} nav={resolveGatewayDashboardNav(user)}>
        {children}
      </DashboardShell>
    );
  }

  return <ConnectingShell longWait={longWait} />;
}
