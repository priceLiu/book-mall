"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBookMallBaseUrl } from "@/lib/book-mall-billing-url";
import { fetchBookMallViewerUser, type BookMallViewerUser } from "@/lib/book-mall-viewer-session";
import {
  FEES_FROM_ACCOUNT_QUERY,
  FEES_FROM_ACCOUNT_VALUE,
} from "@/lib/fees-from-account";

export type FinanceAppTopBarScope = "fees" | "admin";

function FinanceAppTopBarInner({ scope }: { scope: FinanceAppTopBarScope }) {
  const base = getBookMallBaseUrl();
  const searchParams = useSearchParams();
  const fromPersonalCenter =
    scope === "fees" && searchParams.get(FEES_FROM_ACCOUNT_QUERY) === FEES_FROM_ACCOUNT_VALUE;

  const [viewer, setViewer] = useState<BookMallViewerUser | null | undefined>(undefined);
  const signOutUrl = base
    ? `${base}/api/auth/signout?callbackUrl=${encodeURIComponent(`${base}/login`)}`
    : "#";

  useEffect(() => {
    if (!base) {
      setViewer(null);
      return;
    }
    const ac = new AbortController();
    fetchBookMallViewerUser(ac.signal).then((u) => {
      setViewer(u);
    });
    return () => ac.abort();
  }, [base]);

  const isAdmin = viewer?.role === "ADMIN";
  /** 双证：费用区且从个人中心进入 → 始终按普通用户返程；/admin 链路由角色决定。 */
  const showUserBack =
    scope === "admin" ? !isAdmin : fromPersonalCenter || !isAdmin;

  const homeBackHref = base ? (showUserBack ? `${base}/account` : `${base}/admin`) : "#";
  const homeBackLabel = showUserBack ? "返回个人中心" : "返回主站管理后台";

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#e8e8e8] bg-white px-4">
      <div className="min-w-0">
        {base ? (
          viewer === undefined ? (
            <span className="text-xs text-[#8c8c8c]">加载中…</span>
          ) : (
            <a
              href={homeBackHref}
              className="inline-flex items-center rounded border border-[#d9d9d9] bg-white px-3 py-1.5 text-sm text-[#262626] hover:border-[#1890ff] hover:text-[#1890ff]"
            >
              {homeBackLabel}
            </a>
          )
        ) : (
          <span className="text-xs text-[#8c8c8c]">未配置主站地址（NEXT_PUBLIC_BOOK_MALL_URL）</span>
        )}
      </div>
      <div className="shrink-0">
        {base ? (
          <a
            href={signOutUrl}
            className="text-sm font-medium text-[#595959] hover:text-[#1890ff]"
          >
            退出
          </a>
        ) : (
          <span className="text-sm text-[#bfbfbf]">退出</span>
        )}
      </div>
    </header>
  );
}

function TopBarFallback() {
  return <div className="h-11 shrink-0 border-b border-[#e8e8e8] bg-white" aria-hidden />;
}

/**
 * finance-web 顶栏：`scope=fees` 时支持 `?from=account`（个人中心入口），管理员也显示「返回个人中心」。
 */
export function FinanceAppTopBar({ scope }: { scope: FinanceAppTopBarScope }) {
  return (
    <Suspense fallback={<TopBarFallback />}>
      <FinanceAppTopBarInner scope={scope} />
    </Suspense>
  );
}
