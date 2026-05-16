"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, UserCircle2, Wrench } from "lucide-react";

const nav = [
  { href: "/admin", label: "概览", icon: LayoutDashboard, exact: true },
  { href: "/admin/billing/users", label: "用户明细", icon: UserCircle2, prefix: "/admin/billing/users" },
  { href: "/admin/models/coefficients", label: "模型系数", icon: Wrench, prefix: "/admin/models" },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#e8e8e8] bg-[#001529] text-sm text-white/85">
      <div className="flex h-12 items-center border-b border-white/10 px-3 font-medium">管理端</div>
      <nav className="flex-1 space-y-0.5 p-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            "exact" in item && item.exact
              ? pathname === item.href
              : "prefix" in item
                ? pathname.startsWith(item.prefix)
                : pathname === item.href;
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
      <div className="border-t border-white/10 p-2 text-xs text-white/45">
        <Link href="/fees/billing/details" className="text-[#69c0ff] hover:underline">
          返回用户端账单详情
        </Link>
      </div>
    </aside>
  );
}
