"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QUICK_REPLICA_SSO_APP } from "@/lib/qr-sso-app";
import { getMainSiteOrigin } from "@/lib/site-origin";
import {
  buildSilentReEnterHref,
  shouldAttemptSilentSso,
} from "@/lib/tools-silent-sso";
import {
  bumpSsoReenterAttempts,
  MAX_SSO_REENTER_ATTEMPTS,
  readSsoReenterAttempts,
} from "@/lib/sso-reenter-attempts";
import { isSsoReenterSuppressedClient } from "@/lib/tools-logout-next-url";

/**
 * 首页 `/` 为 SEO 公开路由，middleware 不会强制换票。
 * 从 Book 个人中心打开时若尚未写入 tools_token，先静默 re-enter 再展示落地页。
 */
export function QrHomeAuthBootstrap({ children }: { children: ReactNode }) {
  const mainOrigin = getMainSiteOrigin();
  const silentAttemptedRef = useRef(false);
  const [connecting, setConnecting] = useState(() => {
    if (isSsoReenterSuppressedClient()) return false;
    if (!mainOrigin?.trim()) return false;
    if (readSsoReenterAttempts() >= MAX_SSO_REENTER_ATTEMPTS) return false;
    return true;
  });

  useEffect(() => {
    if (silentAttemptedRef.current) return;
    if (!connecting) return;
    if (!shouldAttemptSilentSso({ hasTokenCookie: false, sessionActive: false, loading: false })) {
      setConnecting(false);
      return;
    }
    if (readSsoReenterAttempts() >= MAX_SSO_REENTER_ATTEMPTS) {
      setConnecting(false);
      return;
    }

    const href =
      buildSilentReEnterHref(mainOrigin, "/", QUICK_REPLICA_SSO_APP) ?? null;
    if (!href) {
      setConnecting(false);
      return;
    }

    silentAttemptedRef.current = true;
    bumpSsoReenterAttempts();
    window.location.replace(href);
  }, [connecting, mainOrigin]);

  if (connecting) {
    return (
      <div
        className="flex h-dvh flex-col items-center justify-center gap-3 bg-[var(--qr-bg-page)] text-[var(--qr-text-secondary)]"
        role="status"
        aria-live="polite"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--qr-border)] border-t-[var(--qr-brand)]"
          aria-hidden
        />
        <p className="text-sm">正在连接 Book 账号…</p>
      </div>
    );
  }

  return <>{children}</>;
}
