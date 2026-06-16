"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { bookMallLoginHref, bookMallReEnterHref } from "@/lib/platform-sso-links";
import { isSsoReenterSuppressedClient } from "@/lib/tools-logout-next-url";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/tools-session", { cache: "no-store" });
        const j = (await r.json().catch(() => null)) as { active?: boolean } | null;
        if (cancelled) return;
        if (j?.active) {
          setReady(true);
          return;
        }
        if (isSsoReenterSuppressedClient()) {
          setNeedsLogin(true);
          return;
        }
        const path = typeof window !== "undefined" ? window.location.pathname : "/";
        const reEnter = bookMallReEnterHref(path, "story");
        if (reEnter) {
          window.location.href = reEnter;
          return;
        }
        const login = bookMallLoginHref(typeof window !== "undefined" ? window.location.href : "/");
        if (login) window.location.href = login;
      } catch {
        if (!cancelled) setNeedsLogin(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (ready) return <>{children}</>;

  if (needsLogin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
        <p className="text-sm">会话已退出，请重新连接 Book 账号。</p>
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-white"
          onClick={() => {
            const login = bookMallLoginHref(typeof window !== "undefined" ? window.location.href : "/");
            if (login) window.location.href = login;
          }}
        >
          去主站登录
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
