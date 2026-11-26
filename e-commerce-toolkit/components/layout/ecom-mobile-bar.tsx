"use client";

import Link from "next/link";
import { buildPortalNavItems } from "@/components/portal-nav";
import { PlatformTopupNavLink } from "@/lib/platform-billing/platform-topup-nav-link";
import { ECOM_FEISHU_GUIDE_WIKI_HUB } from "@/lib/ecom-feishu-guide-urls";

/** 窄屏：跨门户入口（原顶栏 Federated 菜单） */
export function EcomMobileBar({ bookOrigin }: { bookOrigin: string }) {
  const portalItems = buildPortalNavItems(bookOrigin).filter(
    (item) => item.href && item.key !== "e-commerce",
  );

  return (
    <header className="flex h-11 shrink-0 flex-col border-b border-[var(--ecom-divider)] bg-[var(--ecom-cream)] md:hidden">
      <div className="flex items-center justify-between px-4 py-2">
        <Link href="/" className="text-sm font-semibold text-[var(--ecom-ink)]">
          电商工具箱
        </Link>
        <div className="flex items-center gap-3">
          {bookOrigin ? (
            <PlatformTopupNavLink
              bookOrigin={bookOrigin}
              className="text-xs font-medium text-[var(--ecom-primary)] hover:underline"
            />
          ) : null}
          <Link href="/workflows/drafts" className="text-xs text-[var(--ecom-muted)] hover:text-[var(--ecom-ink)]">
            我的工作流
          </Link>
          <Link href="/library" className="text-xs text-[var(--ecom-muted)] hover:text-[var(--ecom-ink)]">
            我的资产
          </Link>
          <a
            href={ECOM_FEISHU_GUIDE_WIKI_HUB}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--ecom-muted)] hover:text-[var(--ecom-ink)]"
          >
            使用指南
          </a>
        </div>
      </div>
      <div className="ecom-scrollbar-thin flex gap-3 overflow-x-auto border-t border-[var(--ecom-divider)] px-4 py-2 text-xs text-[var(--ecom-muted)]">
        {portalItems.map((item) => (
          <a
            key={item.key}
            href={item.href!}
            className="shrink-0 whitespace-nowrap hover:text-[var(--ecom-ink)]"
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}
