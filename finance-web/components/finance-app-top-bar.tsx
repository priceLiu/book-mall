"use client";

import { Suspense, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchBookMallViewerUser, type BookMallViewerUser } from "@/lib/book-mall-viewer-session";
import { isPlatformStaff } from "@/lib/permissions";

export type FinanceAppTopBarScope = "fees" | "admin";

function FinanceAppTopBarInner({ scope }: { scope: FinanceAppTopBarScope }) {
  const base = useBookMallBaseUrl();
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
    fetchBookMallViewerUser(base, ac.signal).then((u) => {
      setViewer(u);
    });
    return () => ac.abort();
  }, [base]);

  const isStaff = isPlatformStaff(viewer?.role);
  /** 个人/团队费用区始终回个人中心；管理后台模块回主站后台。 */
  const showUserBack = scope === "admin" ? !isStaff : true;

  const homeBackHref = base ? (showUserBack ? `${base}/account` : `${base}/admin`) : "#";
  const homeBackLabel = showUserBack ? "返回个人中心" : "返回主站后台";

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
 * finance-web 顶栏：个人/团队费用区显示「返回个人中心」；管理后台模块按角色回主站后台。
 */
export function FinanceAppTopBar({ scope }: { scope: FinanceAppTopBarScope }) {
  return (
    <Suspense fallback={<TopBarFallback />}>
      <FinanceAppTopBarInner scope={scope} />
    </Suspense>
  );
}
