"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, FileStack, LayoutGrid, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, Suspense, useEffect } from "react";
import {
  FEES_FROM_ACCOUNT_QUERY,
  FEES_FROM_ACCOUNT_VALUE,
} from "@/lib/fees-from-account";
import { getBookMallBaseUrl } from "@/lib/book-mall-billing-url";
import { fetchBookMallViewerUser, type BookMallViewerUser } from "@/lib/book-mall-viewer-session";

const billingChildren = [
  { href: "/fees/billing/overview", label: "账单概览" },
  { href: "/fees/billing/details", label: "账单详情" },
  { href: "/fees/billing/subscriptions", label: "账单订阅" },
];

function FeesSidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromAccount = searchParams.get(FEES_FROM_ACCOUNT_QUERY) === FEES_FROM_ACCOUNT_VALUE;
  const querySuffix = fromAccount ? `?${FEES_FROM_ACCOUNT_QUERY}=${FEES_FROM_ACCOUNT_VALUE}` : "";
  const [openFees, setOpenFees] = useState(true);
  const [openBill, setOpenBill] = useState(true);
  const [viewer, setViewer] = useState<BookMallViewerUser | null | undefined>(undefined);

  useEffect(() => {
    const base = getBookMallBaseUrl();
    if (!base) {
      setViewer(null);
      return;
    }
    const ac = new AbortController();
    fetchBookMallViewerUser(ac.signal).then(setViewer);
    return () => ac.abort();
  }, []);

  /** 普通用户或从个人中心进入：不显示顶部格图标；管理员直连 `/fees` 且已确认为 ADMIN 时保留。加载中（非个人中心入口）暂显示以免高度跳动。 */
  const showTopIconStrip =
    !fromAccount &&
    (viewer === undefined || (viewer !== null && viewer.role === "ADMIN"));

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#002140] bg-[#001529] text-sm text-white/85">
      {showTopIconStrip ? (
        <div
          className="flex h-12 items-center gap-2 border-b border-white/10 px-3 text-white/85"
          aria-hidden
        >
          <LayoutGrid className="h-4 w-4 shrink-0 opacity-90" />
        </div>
      ) : null}
      <nav className="flex-1 overflow-y-auto p-2">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-white/85 hover:bg-white/10"
          onClick={() => setOpenFees((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            费用
          </span>
          {openFees ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
          )}
        </button>
        {openFees ? (
          <div className="mt-0.5 space-y-0.5 border-l border-white/10 ml-2 pl-2">
            <button
              type="button"
              className="mt-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-white/80 hover:bg-white/10"
              onClick={() => setOpenBill((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <FileStack className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                账单
              </span>
              {openBill ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
              )}
            </button>
            {openBill ? (
              <ul className="mt-0.5 space-y-0.5">
                {billingChildren.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={`${item.href}${querySuffix}`}
                        className={cn(
                          "block rounded px-2 py-2 pl-3",
                          active ? "bg-[#1890ff] font-medium text-white" : "text-white/80 hover:bg-white/10",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}

/**
 * /fees 侧栏 —— 与 {@link AdminSidebar} 同视觉规范（深蓝底 + 高亮项）。
 * 自个人中心进入（`?from=account`）时，子页面导航保留该参数。
 */
export function FeesSidebar() {
  return (
    <Suspense
      fallback={
        <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#002140] bg-[#001529]" aria-hidden />
      }
    >
      <FeesSidebarNav />
    </Suspense>
  );
}
