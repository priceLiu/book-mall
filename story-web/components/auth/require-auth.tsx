"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { storyLoginHref } from "@/lib/portal-auth-links";
import { isSsoReenterSuppressedClient } from "@/lib/tools-logout-next-url";
import {
  bumpSsoReenterAttempts,
  clearSsoReenterAttempts,
  MAX_SSO_REENTER_ATTEMPTS,
  readSsoReenterAttempts,
} from "@/lib/sso-reenter-attempts";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const bookOrigin = useBookMallBaseUrl();
  const [ready, setReady] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const authEntryHref = () => {
    const path =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
    return storyLoginHref(path || "/", bookOrigin);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/tools-session", { cache: "no-store" });
        const j = (await r.json().catch(() => null)) as {
          active?: boolean;
          hasCookie?: boolean;
        } | null;
        if (cancelled) return;
        if (j?.active) {
          clearSsoReenterAttempts();
          setReady(true);
          return;
        }
        if (isSsoReenterSuppressedClient()) {
          setNeedsLogin(true);
          return;
        }
        if (readSsoReenterAttempts() >= MAX_SSO_REENTER_ATTEMPTS) {
          setExhausted(true);
          setNeedsLogin(true);
          return;
        }
        // 无 tools_token 或已失效：统一走 Book re-enter（未登录会落到主站登录页）
        const entry = authEntryHref();
        if (entry.startsWith("/sso-error")) {
          setNeedsLogin(true);
          return;
        }
        bumpSsoReenterAttempts();
        window.location.href = entry;
      } catch {
        if (!cancelled) setNeedsLogin(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // bookOrigin 来自 layout Provider，首屏即有值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookOrigin]);

  if (ready) return <>{children}</>;

  if (needsLogin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
        <p className="text-sm">
          {exhausted
            ? "多次自动连接账号均未成功，请重新登录后继续使用。"
            : "使用此功能需要登录。"}
        </p>
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-white"
          onClick={() => {
            clearSsoReenterAttempts();
            window.location.href = authEntryHref();
          }}
        >
          登录 / 注册
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 size-5 animate-spin" />
      连接 Book 账号…
    </div>
  );
}
