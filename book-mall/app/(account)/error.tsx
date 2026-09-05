"use client";

import { useEffect, useRef } from "react";
import { DbBusyPanel } from "@/components/errors/db-busy-panel";

function isDbBusyError(error: Error): boolean {
  return /SYSTEM_BUSY|DbUnavailableError|connection pool|pool timeout|pool saturated/i.test(
    error.message,
  );
}

/** 连接池类错误：静默自动重试一次，不向用户展示技术提示 */
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retried = useRef(false);

  useEffect(() => {
    if (!isDbBusyError(error)) return;
    if (retried.current) return;
    retried.current = true;
    const t = setTimeout(() => reset(), 600);
    return () => clearTimeout(t);
  }, [error, reset]);

  if (isDbBusyError(error)) {
    return null;
  }

  return (
    <DbBusyPanel
      title="页面加载失败"
      description="请刷新页面重试；若问题持续，请稍后再访问。"
    />
  );
}
