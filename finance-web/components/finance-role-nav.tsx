"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlatformStaff } from "@/lib/permissions";
import type { FinanceViewerPayload } from "@/lib/finance-viewer";

/**
 * 财务控制台顶栏：个人 / 团队 / 系统管理 三入口。
 * - 个人：所有登录用户
 * - 团队：有 TEAM 成员关系的用户
 * - 系统管理：平台员工（运营/财务/超管/legacy ADMIN）
 */
export function FinanceRoleNav({ viewer }: { viewer: FinanceViewerPayload | null | undefined }) {
  const pathname = usePathname();
  if (!viewer) return null;

  const tabs: { href: string; label: string; icon: typeof User; show: boolean }[] = [
    { href: "/fees", label: "个人", icon: User, show: true },
    { href: "/team", label: "团队", icon: Building2, show: viewer.hasTeam },
    {
      href: "/admin",
      label: "系统管理",
      icon: Shield,
      show: isPlatformStaff(viewer.user.role),
    },
  ];

  return (
    <nav className="flex items-center gap-1 rounded-md border border-[#e8e8e8] bg-[#fafafa] p-0.5 text-sm">
      {tabs
        .filter((t) => t.show)
        .map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          const Icon = t.icon;
          const crossScope =
            (t.href === "/admin" && !pathname.startsWith("/admin")) ||
            (t.href === "/fees" && !pathname.startsWith("/fees")) ||
            (t.href === "/team" && !pathname.startsWith("/team"));
          const className = cn(
            "flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors",
            active ? "bg-white font-medium text-[#1890ff] shadow-sm" : "text-[#595959] hover:text-[#262626]",
          );
          const inner = (
            <>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </>
          );
          if (crossScope && !active) {
            return (
              <a
                key={t.href}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {inner}
              </a>
            );
          }
          return (
            <Link key={t.href} href={t.href} className={className}>
              {inner}
            </Link>
          );
        })}
    </nav>
  );
}
