"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  KeyRound,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/team", label: "团队驾驶舱", icon: LayoutDashboard, exact: true },
  { href: "/team/billing", label: "团队账单", icon: Receipt },
  { href: "/team/billing/details", label: "费用明细", icon: Receipt },
  { href: "/team/billing/ledger", label: "积分流水", icon: ScrollText },
  { href: "/team/usage", label: "积分用量", icon: BarChart3 },
  { href: "/team/billing/byok", label: "BYOK 用量", icon: KeyRound },
  { href: "/team/members", label: "成员分账", icon: Users },
] as const;

export function TeamSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#e8e8e8] bg-[#001529] text-sm text-white/85">
      <div className="border-b border-white/10 px-3 py-3 text-base font-semibold text-white">团队财务</div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-2",
                active ? "bg-[#1890ff] text-white" : "hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
