"use client";

import { useEffect, useRef } from "react";
import { DbBusyPanel } from "@/components/errors/db-busy-panel";

function isDbBusyClientError(error: Error): boolean {
  return /SYSTEM_BUSY|DbUnavailableError|connection pool|pool timeout|pool saturated/i.test(
    error.message,
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retried = useRef(false);

  useEffect(() => {
    console.error("[app/error]", error);
    if (!isDbBusyClientError(error) || retried.current) return;
    retried.current = true;
    const t = setTimeout(() => reset(), 600);
    return () => clearTimeout(t);
  }, [error, reset]);

  if (isDbBusyClientError(error)) {
    return null;
  }

  return (
    <DbBusyPanel
      title="页面加载失败"
      description="请刷新页面重试；若问题持续，请稍后再访问。"
    />
  );
}
