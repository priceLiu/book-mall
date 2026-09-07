"use client";

import { useEffect, useRef } from "react";
import { qrReEnterHref } from "@/lib/portal-auth-links";
import {
  bumpSsoReenterAttempts,
  clearSsoReenterAttempts,
  MAX_SSO_REENTER_ATTEMPTS,
  readSsoReenterAttempts,
} from "@/lib/sso-reenter-attempts";

/**
 * 服务端已有 tools_token 但 introspect 未 active（超时/冷启动）时：
 * 先 POST 续签，失败再整页 re-enter，避免误展示公开落地页。
 */
export function QrInactiveSessionRecover() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const refresh = await fetch("/api/tools-session/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (refresh.ok) {
          const data = (await refresh.json().catch(() => null)) as {
            active?: boolean;
          } | null;
          if (data?.active) {
            clearSsoReenterAttempts();
            window.location.reload();
            return;
          }
        }
      } catch {
        /* 续签失败，走 re-enter */
      }

      if (readSsoReenterAttempts() >= MAX_SSO_REENTER_ATTEMPTS) {
        window.location.href = qrReEnterHref("/");
        return;
      }

      bumpSsoReenterAttempts();
      const path =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/";
      window.location.href = qrReEnterHref(path);
    })();
  }, []);

  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--qr-brand)]"
        aria-label="连接主站账号"
      />
    </div>
  );
}
