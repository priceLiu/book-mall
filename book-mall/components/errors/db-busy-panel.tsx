"use client";

import { RefreshCw } from "lucide-react";
import {
  USER_LOAD_RETRY_MESSAGE,
  USER_SYSTEM_BUSY_MESSAGE,
} from "@/lib/db-user-messages";

/** 整页级 fallback（尽量少用；优先静默降级 + 空状态） */
export function DbBusyPanel({
  title = "加载失败",
  description,
}: {
  error?: Error & { digest?: string };
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {description ?? USER_LOAD_RETRY_MESSAGE}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          刷新页面
        </button>
      </div>
    </div>
  );
}

/** @deprecated 不再向用户展示黄色降级条；保留导出避免旧引用编译失败 */
export function DbDegradedBanner(_props: { message?: string }) {
  return null;
}

export { USER_SYSTEM_BUSY_MESSAGE };
