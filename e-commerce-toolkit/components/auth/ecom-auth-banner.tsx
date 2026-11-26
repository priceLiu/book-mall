"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { buildEcomLoginUrl } from "@/lib/ecom-auth";
import { fetchEcomToolsSessionLite } from "@/lib/ecom-tools-session-client";

type Props = {
  returnPath?: string;
};

export function EcomAuthBanner({ returnPath }: Props) {
  const pathname = usePathname();
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchEcomToolsSessionLite()
        .then((d) => {
          if (!cancelled) setSessionActive(Boolean(d.active));
        })
        .catch(() => {
          if (!cancelled) setSessionActive(false);
        });
    };
    load();
    const onRefreshed = () => load();
    window.addEventListener("ecom:tools-session-refreshed", onRefreshed);
    return () => {
      cancelled = true;
      window.removeEventListener("ecom:tools-session-refreshed", onRefreshed);
    };
  }, []);

  const path =
    returnPath ??
    pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "/");
  const loginUrl = buildEcomLoginUrl(path);

  if (sessionActive !== false) return null;

  const message = "当前未登录或会话已过期，生图/成片等 AI 功能需要先登录。";

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--ecom-divider)] bg-[var(--ecom-cream-muted)] px-4 py-2 text-xs text-[var(--ecom-ink)]">
      <span>{message}</span>
      <a
        href={loginUrl}
        className="shrink-0 rounded-full border border-[var(--ecom-border-strong)] bg-[var(--ecom-cream)] px-3 py-1 font-medium text-[var(--ecom-ink)] hover:bg-[var(--ecom-cream-deep)]"
      >
        登录
      </a>
    </div>
  );
}
