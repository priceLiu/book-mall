"use client";

import { isSsoReenterSuppressedClient } from "@private/federated-portal-logout";
import { getBookOriginClient } from "@/lib/auth";
import { isCommonToolsPublicSsoPath } from "@/lib/common-tools-public-paths";
import {
  bumpSsoReenterAttempts,
  clearSsoReenterAttempts,
  MAX_SSO_REENTER_ATTEMPTS,
  readSsoReenterAttempts,
} from "@/lib/sso-reenter-attempts";
import { refreshToolsSessionClient } from "@/lib/tools-session-client";

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
  return `${book}/api/sso/tools/re-enter?app=common-tools&redirect=${encodeURIComponent(
    args.redirectPath,
  )}`;
}

export function isPublicSsoPath(pathname: string): boolean {
  return isCommonToolsPublicSsoPath(pathname);
}

export { isCommonToolsPublicBrowsePath } from "@/lib/common-tools-public-paths";

export function redirectSessionRefresh(
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
  window.location.href = buildReEnterUrl({ bookOrigin: book, redirectPath: path });
}

export function attemptColdStartSso(opts: {
  bookOrigin?: string;
  pathname?: string;
}): void {
  if (typeof window === "undefined") return;
  if (isSsoReenterSuppressedClient()) return;
  const pathname =
    opts.pathname ?? `${window.location.pathname}${window.location.search}`;
  if (isPublicSsoPath(window.location.pathname)) return;
  if (readSsoReenterAttempts() >= MAX_SSO_REENTER_ATTEMPTS) return;

  void (async () => {
    if (await refreshToolsSessionClient()) return;

    // 无 tools_token：允许匿名浏览工具页，使用功能时再登录。
    if (
      typeof document !== "undefined" &&
      !document.cookie.includes("tools_token=")
    ) {
      return;
    }

    const book = resolveBookOrigin(opts.bookOrigin);
    if (!book) return;

    bumpSsoReenterAttempts();
    window.location.href = buildReEnterUrl({
      bookOrigin: book,
      redirectPath: pathname.startsWith("/") ? pathname : `/${pathname}`,
    });
  })();
}

export type ToolsSessionInfo = {
  hasCookie: boolean;
  active: boolean;
  tokenExpiresAt?: number | null;
};

export async function fetchToolsSession(): Promise<ToolsSessionInfo> {
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

export type EnsureSessionFreshOptions = {
  bookOrigin?: string;
  returnPath?: string;
  redirectOnFailure?: boolean;
};

export async function ensureSessionFresh(
  thresholdSec = 120,
  opts: EnsureSessionFreshOptions = {},
): Promise<boolean> {
  const session = await fetchToolsSession();
  const exp = session.tokenExpiresAt;
  const needsRefresh =
    !session.hasCookie ||
    !session.active ||
    (exp != null && exp * 1000 < Date.now() + thresholdSec * 1000);
  if (!needsRefresh) return true;

  if (await refreshToolsSessionClient()) return true;

  if (opts.redirectOnFailure) {
    redirectSessionRefresh(opts.returnPath, opts.bookOrigin);
  }
  return false;
}

export { clearSsoReenterAttempts };
