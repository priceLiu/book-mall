"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinanceViewerPayload } from "@/lib/finance-viewer";
import { feesFromAccountQuerySuffix } from "@/lib/fees-from-account";

/**
 * 普通用户财务区顶栏：个人 / 团队切换（不含系统管理门户入口）。
 */
export function FinanceUserScopeNav({
  viewer,
  scope,
}: {
  viewer: FinanceViewerPayload | null | undefined;
  scope: "fees" | "team";
}) {
  const pathname = usePathname();
  if (!viewer) return null;

  const tabs: { href: string; label: string; icon: typeof User; show: boolean }[] = [
    {
      href: `/fees/usage${feesFromAccountQuerySuffix()}`,
      label: "个人",
      icon: User,
      show: true,
    },
    {
      href: "/team/billing",
      label: "团队",
      icon: Building2,
      show: viewer.hasTeam,
    },
  ];

  const visible = tabs.filter((t) => t.show);
  if (visible.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 rounded-md border border-[#e8e8e8] bg-[#fafafa] p-0.5 text-sm">
      {visible.map((t) => {
        const inFees = pathname.startsWith("/fees");
        const inTeam = pathname.startsWith("/team");
        const active =
          (t.href.startsWith("/fees") && inFees && scope === "fees") ||
          (t.href.startsWith("/team") && inTeam && scope === "team");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors",
              active ? "bg-white font-medium text-[#1890ff] shadow-sm" : "text-[#595959] hover:text-[#262626]",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
