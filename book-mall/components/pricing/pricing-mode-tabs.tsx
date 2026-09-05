"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/pricing", label: "订阅价格", exact: true },
  { href: "/pricing/api", label: "API 价格" },
];

export function PricingModeTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("site-pricing-mode-tabs", className)}
      aria-label="报价类型"
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn("site-pricing-mode-tab", active && "site-pricing-mode-tab-active")}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
