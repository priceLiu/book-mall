"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  KeyRound,
  LayoutGrid,
  Receipt,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, Suspense, useEffect } from "react";
import {
  FEES_FROM_ACCOUNT_QUERY,
  FEES_FROM_ACCOUNT_VALUE,
} from "@/lib/fees-from-account";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchBookMallViewerUser, type BookMallViewerUser } from "@/lib/book-mall-viewer-session";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_GROUPS = [
  {
    id: "usage",
    label: "用量",
    items: [{ href: "/fees/usage", label: "积分用量", icon: BarChart3 }],
  },
  {
    id: "billing",
    label: "账单",
    items: [
      { href: "/fees/billing/overview", label: "账单概览", icon: Receipt },
      { href: "/fees/billing/details", label: "费用明细", icon: Receipt },
      { href: "/fees/billing/ledger", label: "积分流水", icon: ScrollText },
      { href: "/fees/billing/subscriptions", label: "账单订阅", icon: Receipt },
    ],
  },
  {
    id: "byok",
    label: "BYOK",
    items: [{ href: "/fees/billing/byok", label: "BYOK 任务用量", icon: KeyRound }],
  },
] as const;

/** 自个人中心进入时，侧栏与个人中心菜单对齐（3～4 项 + 图标）。 */
const ACCOUNT_NAV_ITEMS: NavItem[] = [
  { href: "/fees/usage", label: "积分用量", icon: BarChart3 },
  { href: "/fees/billing/details", label: "费用明细", icon: Receipt },
  { href: "/fees/billing/ledger", label: "积分流水", icon: ScrollText },
  { href: "/fees/billing/byok", label: "BYOK 任务用量", icon: KeyRound },
];

function FeesSidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = useBookMallBaseUrl();
  const fromAccount = searchParams.get(FEES_FROM_ACCOUNT_QUERY) === FEES_FROM_ACCOUNT_VALUE;
  const querySuffix = fromAccount ? `?${FEES_FROM_ACCOUNT_QUERY}=${FEES_FROM_ACCOUNT_VALUE}` : "";
  const [openFees, setOpenFees] = useState(true);
  const [viewer, setViewer] = useState<BookMallViewerUser | null | undefined>(undefined);

  useEffect(() => {
    if (!base) {
      setViewer(null);
      return;
    }
    const ac = new AbortController();
    fetchBookMallViewerUser(base, ac.signal).then(setViewer);
    return () => ac.abort();
  }, [base]);

  const showTopIconStrip =
    !fromAccount &&
    (viewer === undefined || (viewer !== null && viewer.role === "ADMIN"));

  function renderLink(item: NavItem) {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={`${item.href}${querySuffix}`}
          className={cn(
            "flex items-center gap-2 rounded px-2 py-2 pl-3",
            active ? "bg-[#1890ff] font-medium text-white" : "text-white/80 hover:bg-white/10",
          )}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          {item.label}
        </Link>
      </li>
    );
  }

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
        {fromAccount ? (
          <>
            <p className="px-2 py-2 text-xs font-medium text-white/45">积分与费用</p>
            <ul className="space-y-0.5">{ACCOUNT_NAV_ITEMS.map((item) => renderLink(item))}</ul>
          </>
        ) : (
          <>
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
              <div className="mt-1 space-y-3 border-l border-white/10 ml-2 pl-2">
                {NAV_GROUPS.map((group) => (
                  <div key={group.id}>
                    <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white/45">
                      {group.label}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {group.items.map((item) => renderLink(item))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
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
