"use client";

import { PortalNav } from "@/components/portal-nav";
import { getBookAccountUrl } from "@/lib/site-origin";
import { EcomButtonSecondaryLink } from "@/components/ui/ecom-button";

type Props = {
  authed?: boolean;
};

/** 固定顶栏：黑底居中跨门户导航，右侧个人中心 */
export function EcomPortalTopBar({ authed = true }: Props) {
  const bookAccountUrl = getBookAccountUrl();

  return (
    <header className="sticky top-0 z-50 grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/10 bg-[#0c0c0e] px-4 md:h-14 md:px-5">
      <div className="hidden min-w-0 md:block">
        <span className="text-sm font-semibold text-white/90">电商工具箱</span>
      </div>
      <PortalNav current="e-commerce" variant="dark" />
      <div className="flex min-w-0 items-center justify-end gap-2">
        {authed && bookAccountUrl ? (
          <EcomButtonSecondaryLink
            href={bookAccountUrl}
            size="sm"
            dark
            className="!border-white/20 !text-white/90 hover:!bg-white/10"
          >
            个人中心
          </EcomButtonSecondaryLink>
        ) : null}
        {authed ? (
          <a
            href="/api/auth/logout"
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
          >
            退出
          </a>
        ) : null}
      </div>
    </header>
  );
}
