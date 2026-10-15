"use client";

import { useEffect, useRef } from "react";
import { DbBusyPanel } from "@/components/errors/db-busy-panel";
import { USER_SYSTEM_BUSY_MESSAGE } from "@/lib/db-user-messages";

function isDbBusyClientError(error: Error): boolean {
  return /SYSTEM_BUSY|DbUnavailableError|connection pool|pool timeout|pool saturated|Server has closed the connection|Can't reach database|Timed out fetching a new connection|Invalid prisma\./i.test(
    error.message,
  );
}

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retried = useRef(false);

  useEffect(() => {
    console.error("[admin/error]", error);
    if (!isDbBusyClientError(error) || retried.current) return;
    retried.current = true;
    const t = setTimeout(() => reset(), 800);
    return () => clearTimeout(t);
  }, [error, reset]);

  if (isDbBusyClientError(error)) {
    return (
      <DbBusyPanel
        title="驾驶舱加载失败"
        description={USER_SYSTEM_BUSY_MESSAGE}
      />
    );
  }

  return (
    <DbBusyPanel
      title="驾驶舱加载失败"
      description="请刷新页面重试；若问题持续，请稍后再访问。"
    />
  );
}
