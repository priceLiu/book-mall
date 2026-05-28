"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { bookMallLoginHref, bookMallReEnterHref } from "@/lib/platform-sso-links";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/tools-session", { cache: "no-store" });
        const j = (await r.json().catch(() => null)) as { active?: boolean; hasCookie?: boolean } | null;
        if (cancelled) return;
        if (j?.active) {
          setReady(true);
          return;
        }
        const path = typeof window !== "undefined" ? window.location.pathname : "/projects";
        const reEnter = bookMallReEnterHref(path, "canvas");
        if (reEnter) {
          window.location.href = reEnter;
          return;
        }
        const login = bookMallLoginHref(typeof window !== "undefined" ? window.location.href : "/");
        if (login) window.location.href = login;
      } catch {
        if (!cancelled) setReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas-bg)] text-[var(--canvas-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        连接 Book 账号…
      </div>
    );
  }

  return <>{children}</>;
}
