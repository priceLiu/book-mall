"use client";

import { buildEcomLoginUrl, getBookOriginClient } from "@/lib/ecom-auth";
import {
  bumpEcomSsoReenterAttempts,
  clearEcomSsoReenterAttempts,
  MAX_ECOM_SSO_REENTER_ATTEMPTS,
  readEcomSsoReenterAttempts,
} from "@/lib/ecom-sso-reenter-attempts";
import { refreshEcomToolsSessionClient } from "@/lib/ecom-tools-session-client";

const REFRESH_COOLDOWN_MS = 45_000;
let lastRefreshAt = 0;

function resolveBookOrigin(bookOrigin?: string): string {
  const raw = bookOrigin?.trim() || getBookOriginClient();
  return raw.replace(/\/$/, "");
}

function buildReEnterUrl(args: {
  bookOrigin?: string;
  redirectPath: string;
}): string {
  const book = resolveBookOrigin(args.bookOrigin);
  return `${book}/api/sso/tools/re-enter?app=e-commerce&redirect=${encodeURIComponent(
    args.redirectPath,
  )}`;
}

const ECOM_SSO_INTERNAL_PATH_PREFIXES = [
  "/sso-error",
  "/auth/sso/callback",
  "/auth/sso/silent-done",
] as const;

export function isEcomPublicSsoPath(pathname: string): boolean {
  return ECOM_SSO_INTERNAL_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * 全页换票：走主站 re-enter（与 tool-web / canvas 一致，避免 iframe 第三方 Cookie 被拦）。
 */
export function redirectEcomSessionRefresh(
  returnPath?: string,
  bookOrigin?: string,
): void {
  const path =
    returnPath ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/");
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) return;
  lastRefreshAt = now;

  const book = resolveBookOrigin(bookOrigin);
  if (book) {
    window.location.href = buildReEnterUrl({ bookOrigin: book, redirectPath: path });
    return;
  }
  window.location.href = buildEcomLoginUrl(path);
}

/**
 * 冷启动 / 硬刷新：先 POST 续签（过期 token），失败则整页 re-enter（主站 Cookie 同页一级）。
 */
export function attemptEcomColdStartSso(opts: {
  bookOrigin?: string;
  pathname?: string;
}): void {
  if (typeof window === "undefined") return;
  const pathname =
    opts.pathname ??
    `${window.location.pathname}${window.location.search}`;
  if (isEcomPublicSsoPath(window.location.pathname)) return;
  if (readEcomSsoReenterAttempts() >= MAX_ECOM_SSO_REENTER_ATTEMPTS) return;

  void (async () => {
    if (await refreshEcomToolsSessionClient()) return;

    const book = resolveBookOrigin(opts.bookOrigin);
    if (!book) return;

    bumpEcomSsoReenterAttempts();
    window.location.href = buildReEnterUrl({
      bookOrigin: book,
      redirectPath: pathname.startsWith("/") ? pathname : `/${pathname}`,
    });
  })();
}

/**
 * 静默续期：优先 server refresh；不在此处整页跳转（避免 API 401 时打断编辑）。
 */
export async function silentEcomSessionRefresh(
  _bookOrigin?: string,
): Promise<boolean> {
  return refreshEcomToolsSessionClient();
}

export type EcomToolsSessionInfo = {
  hasCookie: boolean;
  active: boolean;
  tokenExpiresAt?: number | null;
};

/** 查询工具站会话；token 将过期时返回 expiresAt（秒级时间戳） */
export async function fetchEcomToolsSession(): Promise<EcomToolsSessionInfo> {
  const res = await fetch("/api/tools-session", {
    credentials: "include",
    cache: "no-store",
  });
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

export type EnsureEcomSessionFreshOptions = {
  bookOrigin?: string;
  returnPath?: string;
  /** 静默续期失败时是否整页跳转换票（后台心跳应 false，生图/提交前应 true） */
  redirectOnFailure?: boolean;
};

/**
 * 令牌将在 thresholdSec 内过期时静默续签。
 */
export async function ensureEcomSessionFresh(
  thresholdSec = 120,
  opts: EnsureEcomSessionFreshOptions = {},
): Promise<boolean> {
  const session = await fetchEcomToolsSession();
  const exp = session.tokenExpiresAt;
  const needsRefresh =
    !session.hasCookie ||
    !session.active ||
    (exp != null && exp * 1000 < Date.now() + thresholdSec * 1000);
  if (!needsRefresh) return true;

  if (await refreshEcomToolsSessionClient()) return true;

  if (opts.redirectOnFailure) {
    redirectEcomSessionRefresh(opts.returnPath, opts.bookOrigin);
  }
  return false;
}

export { clearEcomSsoReenterAttempts };
