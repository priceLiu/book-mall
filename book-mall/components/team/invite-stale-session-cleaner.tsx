"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** 检测到与邀请不一致的旧 Cookie 时，静默清除并刷新 RSC（不跳转离开邀请页）。 */
export function InviteStaleSessionCleaner({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;

    void (async () => {
      try {
        await fetch("/api/auth/clear-session-cookies", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        /* 非致命：UI 已按匿名处理 */
      }
      router.refresh();
    })();
  }, [enabled, router]);

  return null;
}
