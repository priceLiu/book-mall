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
import { silentGatewaySessionRefresh } from "@/lib/gateway-silent-sso";

type SessionResponse = { user: GatewayDashboardUser | null };

/**
 * 连续静默自动重连/换票上限；超过则停下并提示用户手动重连/登录。
 * 涵盖两类：①主站 DB 瞬时不可用（重试 session）；②令牌过期/失效（隐藏 iframe 自动换票）。
 */
const MAX_RECONNECT_ATTEMPTS = 6;

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

function ReconnectFailedShell({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--gw-bg)] p-6">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-[var(--gw-ink)]">
          多次自动连接服务均未成功
        </p>
        <p className="mt-2 text-xs text-[var(--gw-muted)]">
          请重试连接；若仍失败，请重新登录后继续使用。
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-[var(--gw-border)] bg-[var(--gw-surface)] px-4 py-2 text-sm text-[var(--gw-ink)] transition hover:bg-[var(--gw-hover)]"
          >
            重试连接
          </button>
          <a
            href="/login"
            className="rounded-md border border-[var(--gw-accent)]/40 bg-[var(--gw-accent)]/15 px-4 py-2 text-sm text-[var(--gw-accent)] transition hover:bg-[var(--gw-accent)]/25"
          >
            重新登录
          </a>
        </div>
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
  const [failed, setFailed] = useState(false);
  const attemptRef = useRef(0);
  const [reconnectNonce, setReconnectNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        // 瞬时错误连续自动重连达到上限后停下，提示用户手动重连/登录
        if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setFailed(true);
          return;
        }
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
          let data: SessionResponse | null = null;
          if (res.ok) {
            try {
              data = raw ? (JSON.parse(raw) as SessionResponse) : null;
            } catch {
              data = null;
            }
          }
          if (data?.user) {
            setUser(data.user);
            return;
          }
          // 令牌过期/失效：隐藏 iframe 自动换票（用户无感），计入重连次数；
          // 主站会话也失效则换票失败，达上限后提示重新登录。
          attemptRef.current += 1;
          if (attemptRef.current >= 4) setLongWait(true);
          const refreshed = await silentGatewaySessionRefresh();
          if (refreshed) {
            // 新 cookie 已写入：立刻重取 session（下一轮循环）
            continue;
          }
          await sleepMs(gatewayTransientRetryDelayMs(attemptRef.current));
          continue;
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
  }, [reconnectNonce]);

  if (user) {
    return (
      <DashboardShell user={user} nav={resolveGatewayDashboardNav(user)}>
        {children}
      </DashboardShell>
    );
  }

  if (failed) {
    return (
      <ReconnectFailedShell
        onRetry={() => {
          attemptRef.current = 0;
          setLongWait(false);
          setFailed(false);
          setReconnectNonce((n) => n + 1);
        }}
      />
    );
  }

  return <ConnectingShell longWait={longWait} />;
}
