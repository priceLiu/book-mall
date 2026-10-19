"use client";

import { bookMallLoginHint } from "@/lib/book-mall-login-hint";
import { bookMallUnreachableMessage, bookMallViewerTimeoutLabel } from "@/lib/book-mall-fetch-timeout";
import { FinancePageState } from "@/components/finance-page-shell";

export function FinanceBookMallUnreachableState({
  base,
  compact,
}: {
  base: string;
  compact?: boolean;
}) {
  const login = bookMallLoginHint(base, "admin");
  const body = (
    <>
      <p className="font-medium text-[#cf1322]">无法连接 Book 主站</p>
      <p className="mt-2 leading-relaxed">{bookMallUnreachableMessage(base)}</p>
      <p className="mt-2 text-xs text-[#8c8c8c]">
        超时阈值：{bookMallViewerTimeoutLabel()}。平台驾驶舱与「今日看板」在 Book 主站{" "}
        <strong className="font-medium text-[#595959]">/admin/today</strong>（一般为{" "}
        <code className="rounded bg-[#f5f5f5] px-1">localhost:3000</code>
        ），不在本财务站（
        <code className="rounded bg-[#f5f5f5] px-1">localhost:3002</code>）。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`${base.replace(/\/$/, "")}/admin/today`}
          className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white hover:bg-[#096dd9]"
        >
          打开主站 · 今日看板
        </a>
        <a
          href={login.loginUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-[#d9d9d9] bg-white px-3 py-1.5 text-sm text-[#262626] hover:border-[#1890ff]"
        >
          主站登录
        </a>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded border border-[#d9d9d9] bg-white px-3 py-1.5 text-sm text-[#262626] hover:border-[#1890ff]"
        >
          刷新本页
        </button>
      </div>
    </>
  );

  if (compact) {
    return <div className="px-3 py-2 text-xs text-[#ffccc7]">{body}</div>;
  }
  return (
    <FinancePageState variant="error">
      <div className="mx-auto max-w-xl">{body}</div>
    </FinancePageState>
  );
}
