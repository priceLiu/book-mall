/** 浏览器侧静默续签 tools_token（P0 / P2） */

import { sleepMs } from "@/lib/fetch-with-db-retry";

let refreshInflight: Promise<boolean> | null = null;

/** 默认 JWT TTL 600s · 每 60s 静默续签（服务端在距过期 180s 内会主动换票） */
const SESSION_KEEPALIVE_MS = 60_000;
const SESSION_REFRESH_RETRIES = 3;
const SESSION_REFRESH_RETRY_MS = 700;

export type RefreshCanvasSessionOptions = {
  /** 为 true 时不广播 session-expired（供 API 层静默重试） */
  silent?: boolean;
  retries?: number;
};

async function postToolsSessionRefresh(): Promise<{
  ok: boolean;
  revoked: boolean;
}> {
  const r = await fetch("/api/tools-session/refresh", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await r.json().catch(() => null)) as {
    active?: boolean;
    refreshed?: boolean;
    error?: string;
    code?: string;
  } | null;

  if (r.ok && (data?.active || data?.refreshed)) {
    window.dispatchEvent(new CustomEvent("canvas:tools-session-refreshed"));
    return { ok: true, revoked: false };
  }

  const blob = `${data?.error ?? ""} ${data?.code ?? ""}`.toLowerCase();
  const revoked =
    data?.code === "SESSION_REVOKED" ||
    blob.includes("session_revoked") ||
    blob.includes("别处登录");
  return { ok: false, revoked };
}

export async function refreshCanvasToolsSessionClient(
  opts?: RefreshCanvasSessionOptions,
): Promise<boolean> {
  if (refreshInflight) return refreshInflight;

  const silent = opts?.silent ?? false;
  const retries = Math.max(1, opts?.retries ?? SESSION_REFRESH_RETRIES);

  refreshInflight = (async () => {
    let lastRevoked = false;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await postToolsSessionRefresh();
        if (result.ok) return true;
        lastRevoked = result.revoked;
        if (result.revoked) break;
      } catch {
        /* 网络抖动 · 重试 */
      }
      if (attempt < retries - 1) {
        await sleepMs(SESSION_REFRESH_RETRY_MS * (attempt + 1));
      }
    }

    if (!silent && lastRevoked) {
      window.dispatchEvent(new CustomEvent("canvas:tools-session-revoked"));
    }
    return false;
  })().finally(() => {
    refreshInflight = null;
  });

  return refreshInflight;
}

export function isCanvasToolsSessionUnauthorized(
  raw: string,
  status?: number,
): boolean {
  if (status === 401) return true;
  const t = raw.trim();
  return (
    t.includes("UNAUTHORIZED") ||
    t.includes("401") ||
    t.includes("缺少 Bearer Token") ||
    t.includes("无效或过期的工具令牌") ||
    t.includes("工具站登录令牌") ||
    t.includes("登录已失效") ||
    t.includes("重新连接主站账号") ||
    t.includes("会话已在别处登录")
  );
}

/** 画布页活跃时定期续签 + 回前台立即续签（静默，不弹横幅） */
export function startCanvasToolsSessionKeepalive(): () => void {
  if (typeof window === "undefined") return () => {};

  let intervalId: number | null = null;

  const tick = () => {
    if (document.visibilityState !== "visible") return;
    void refreshCanvasToolsSessionClient({ silent: true });
  };

  const onForeground = () => {
    if (document.visibilityState !== "visible") return;
    void refreshCanvasToolsSessionClient({ silent: true });
  };

  intervalId = window.setInterval(tick, SESSION_KEEPALIVE_MS);
  document.addEventListener("visibilitychange", onForeground);
  window.addEventListener("focus", onForeground);
  window.setTimeout(tick, 20_000);

  return () => {
    if (intervalId !== null) window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onForeground);
    window.removeEventListener("focus", onForeground);
  };
}
