"use client";

import { useEffect, useState } from "react";

import { buildEcomLoginUrl } from "@/lib/ecom-auth";

type Props = {
  returnPath?: string;
};

export function EcomAuthBanner({ returnPath }: Props) {
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tools-session", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { active?: boolean }) => {
        if (!cancelled) setSessionActive(Boolean(d.active));
      })
      .catch(() => {
        if (!cancelled) setSessionActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const path =
    returnPath ??
    (typeof window !== "undefined" ? window.location.pathname : "/");
  const loginUrl = buildEcomLoginUrl(path);

  if (sessionActive !== false) return null;

  const message = "当前未登录或会话已过期，生图/成片等 AI 功能需要先登录。";

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--ecom-chrome-border-subtle)] bg-[var(--ecom-chrome-surface)] px-4 py-2 text-xs text-[var(--ecom-chrome-text)]">
      <span>{message}</span>
      <a
        href={loginUrl}
        className="shrink-0 rounded-full border border-[var(--ecom-chrome-border)] bg-[var(--ecom-chrome-surface-raised)] px-3 py-1 font-medium text-[var(--ecom-chrome-text)] hover:bg-[var(--ecom-chrome-hover)]"
      >
        登录
      </a>
    </div>
  );
}
