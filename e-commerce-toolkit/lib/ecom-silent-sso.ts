"use client";

import { buildEcomLoginUrl, getBookOriginClient } from "@/lib/ecom-auth";

const REFRESH_COOLDOWN_MS = 45_000;
let lastRefreshAt = 0;

/** 静默换票完成后，子页面回传给父页面的消息类型 */
export const ECOM_SILENT_SSO_MESSAGE = "ecom-sso-refreshed" as const;
/** 静默换票的回跳着陆页（轻量页，仅 postMessage） */
const SILENT_DONE_PATH = "/auth/sso/silent-done";
const SILENT_REFRESH_TIMEOUT_MS = 12_000;
const SILENT_REFRESH_MIN_GAP_MS = 8_000;

let silentRefreshInFlight: Promise<boolean> | null = null;
let lastSilentRefreshOkAt = 0;

/** 经主站静默换票后回到当前路径（全页跳转，兜底用） */
export function redirectEcomSessionRefresh(returnPath?: string): void {
  const path =
    returnPath ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/");
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) return;
  lastRefreshAt = now;
  window.location.href = buildEcomLoginUrl(path);
}

/** 直连主站 re-enter（不经 /ecom-open 过渡页），用于隐藏 iframe 静默换票 */
function buildSilentReEnterUrl(): string {
  const book = getBookOriginClient().replace(/\/$/, "");
  return `${book}/api/sso/tools/re-enter?app=e-commerce&redirect=${encodeURIComponent(
    SILENT_DONE_PATH,
  )}`;
}

/**
 * 隐藏 iframe 静默换票：book 与 ecom 同站（ai-code8.com / localhost），
 * iframe 内 re-enter 可带上主站会话 Cookie；换票链最终落在 ecom 同源着陆页，
 * 由其 postMessage 通知父页面完成。成功返回 true，超时/失败返回 false。
 */
export function silentEcomSessionRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (silentRefreshInFlight) return silentRefreshInFlight;
  // 刚成功续期过则视为仍新鲜，避免心跳/重试短时间重复换票
  if (Date.now() - lastSilentRefreshOkAt < SILENT_REFRESH_MIN_GAP_MS) {
    return Promise.resolve(true);
  }

  silentRefreshInFlight = new Promise<boolean>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = "session-refresh";
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      width: "1px",
      height: "1px",
      border: "0",
      visibility: "hidden",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
      if (ok) lastSilentRefreshOkAt = Date.now();
      silentRefreshInFlight = null;
      resolve(ok);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === ECOM_SILENT_SSO_MESSAGE) finish(true);
    };

    const timer = window.setTimeout(() => finish(false), SILENT_REFRESH_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    iframe.src = buildSilentReEnterUrl();
    document.body.appendChild(iframe);
  });

  return silentRefreshInFlight;
}

export type EcomToolsSessionInfo = {
  hasCookie: boolean;
  active: boolean;
  tokenExpiresAt?: number | null;
};

/** 查询工具站会话；token 将过期时返回 expiresAt（秒级时间戳） */
export async function fetchEcomToolsSession(): Promise<EcomToolsSessionInfo> {
  const res = await fetch("/api/tools-session", { credentials: "include", cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as {
    hasCookie?: boolean;
    active?: boolean;
    tokenExpiresAt?: number | null;
  };
  return {
    hasCookie: Boolean(data.hasCookie),
    active: Boolean(data.active),
    tokenExpiresAt:
      typeof data.tokenExpiresAt === "number" ? data.tokenExpiresAt : null,
  };
}

/**
 * 令牌将在 thresholdSec 内过期时静默换票（隐藏 iframe）。
 * 静默失败（主站会话也失效）才退回全页跳转换票。
 */
export async function ensureEcomSessionFresh(thresholdSec = 120): Promise<boolean> {
  const session = await fetchEcomToolsSession();
  const exp = session.tokenExpiresAt;
  const needsRefresh =
    !session.hasCookie ||
    !session.active ||
    (exp != null && exp * 1000 < Date.now() + thresholdSec * 1000);
  if (!needsRefresh) return true;

  if (await silentEcomSessionRefresh()) return true;

  redirectEcomSessionRefresh();
  return false;
}
