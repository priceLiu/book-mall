"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function pathToToolKey(pathname: string): string {
  const p = pathname.trim() || "/";
  if (p === "/") return "home";
  const seg = p.replace(/^\//, "").replace(/\//g, "__");
  return seg.slice(0, 64);
}

/**
 * 客户端挂载后异步上报「页面浏览」打点，不阻塞 RSC；身份由服务端从 Cookie 转发主站。
 */
export function ToolUsageBeacon({ enabled }: { enabled: boolean }) {
  const pathname = usePathname() || "/";
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const toolKey = pathToToolKey(pathname);
    const payload = {
      toolKey,
      action: "page_view",
      meta: { path: pathname },
    };

    fetch("/api/tool-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, enabled]);

  return null;
}
