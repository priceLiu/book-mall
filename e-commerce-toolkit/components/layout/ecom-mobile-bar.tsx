"use client";

import Link from "next/link";
import { buildPortalNavItems } from "@/components/portal-nav";

/** 窄屏：跨门户入口（原顶栏 Federated 菜单） */
export function EcomMobileBar({ bookOrigin }: { bookOrigin: string }) {
  const portalItems = buildPortalNavItems(bookOrigin).filter(
    (item) => item.href && item.key !== "e-commerce",
  );

  return (
    <header className="flex h-11 shrink-0 flex-col border-b border-[#e8e8ed] bg-white md:hidden">
      <div className="flex items-center justify-between px-4 py-2">
        <Link href="/" className="text-sm font-semibold text-[#1d1d1f]">
          电商工具箱
        </Link>
        <Link href="/library" className="text-xs text-[#6e6e73] hover:text-[#1d1d1f]">
          我的资产
        </Link>
      </div>
      <div className="ecom-scrollbar-thin flex gap-3 overflow-x-auto border-t border-[#f0f0f2] px-4 py-2 text-xs text-[#6e6e73]">
        {portalItems.map((item) => (
          <a
            key={item.key}
            href={item.href!}
            className="shrink-0 whitespace-nowrap hover:text-[#1d1d1f]"
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}
