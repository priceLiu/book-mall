"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, Receipt, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  FEES_FROM_ACCOUNT_QUERY,
  FEES_FROM_ACCOUNT_VALUE,
} from "@/lib/fees-from-account";

type NavItem = { href: string; label: string; icon: LucideIcon };

/** 与个人中心菜单对齐；须从 Book 个人中心进入（?from=account）。 */
const ACCOUNT_NAV_ITEMS: NavItem[] = [
  { href: "/fees/usage", label: "积分用量", icon: BarChart3 },
  { href: "/fees/billing/details", label: "费用明细", icon: Receipt },
  { href: "/fees/billing/ledger", label: "积分流水", icon: ScrollText },
];

function FeesSidebarNav() {
  const pathname = usePathname();
  const base = useBookMallBaseUrl();
  const querySuffix = `?${FEES_FROM_ACCOUNT_QUERY}=${FEES_FROM_ACCOUNT_VALUE}`;
  const accountHomeHref = base ? `${base}/account` : "#";

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
      <div className="border-b border-white/10 p-2">
        <a
          href={accountHomeHref}
          className="flex items-center gap-2 rounded px-2 py-2 text-white/85 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          返回个人中心
        </a>
      </div>
      <nav className="finance-sidebar-scroll flex-1 overflow-y-auto p-2">
        <p className="px-2 py-2 text-xs font-medium text-white/45">积分与费用</p>
        <ul className="space-y-0.5">{ACCOUNT_NAV_ITEMS.map((item) => renderLink(item))}</ul>
      </nav>
    </aside>
  );
}

/**
 * /fees 侧栏 —— 个人费用子页 + 返回个人中心；入口由 Book 个人中心经 middleware 校验 `?from=account`。
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
