"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [{ href: "/team/billing", label: "团队账单", icon: Users }] as const;

export function TeamSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#e8e8e8] bg-[#001529] text-sm text-white/85">
      <div className="border-b border-white/10 px-3 py-3 text-base font-semibold text-white">团队财务</div>
      <nav className="flex-1 space-y-0.5 p-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
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
