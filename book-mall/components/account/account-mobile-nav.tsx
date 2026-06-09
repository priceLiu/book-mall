"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "概览", exact: true },
  { href: "/account/subscription", label: "订阅" },
  { href: "/account/usage", label: "用量" },
  { href: "/account/team", label: "团队" },
  { href: "/account/team/billing", label: "团队账单" },
  { href: "/account/courses", label: "学堂" },
  { href: "/pricing", label: "套餐" },
  { href: "/account/billing", label: "费用" },
  { href: "/account/gateway", label: "Gateway" },
  { href: "/account/security", label: "安全" },
  { href: "/account/withdraw", label: "提现" },
] as const;

export function AccountMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-6 flex gap-2 overflow-x-auto pb-1 md:hidden"
      aria-label="个人中心快捷导航"
    >
      {LINKS.map((item) => {
        const active =
          "exact" in item && item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
