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
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e8e8ed] bg-[#f5f5f7] px-4 py-2 text-xs text-[#1d1d1f]">
      <span>{message}</span>
      <a
        href={loginUrl}
        className="shrink-0 rounded-full border border-[#d2d2d7] bg-white px-3 py-1 font-medium hover:bg-[#ebebed]"
      >
        登录
      </a>
    </div>
  );
}
