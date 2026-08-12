"use client";

import { PortalNav } from "@/components/portal-nav";
import { getBookAccountUrl } from "@/lib/site-origin";
import { EcomButtonSecondaryLink } from "@/components/ui/ecom-button";

type Props = {
  authed?: boolean;
  bookOrigin?: string | null;
};

/** 固定顶栏：黑底居中跨门户导航（六站），右侧个人中心 */
export function EcomPortalTopBar({ authed = true, bookOrigin = null }: Props) {
  const bookAccountUrl = getBookAccountUrl();

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-white/10 bg-[#0c0c0e]">
      <div className="flex h-12 items-center gap-2 px-3 md:h-14 md:gap-3 md:px-5">
        <div className="flex w-[6.5rem] shrink-0 items-center sm:w-28">
          <span className="truncate text-sm font-semibold text-white/90">电商工具箱</span>
        </div>

        <div className="flex min-h-[2rem] min-w-0 flex-1 items-center justify-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PortalNav
            current="e-commerce"
            variant="dark"
            bookOrigin={bookOrigin}
            className="shrink-0 whitespace-nowrap"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-2 md:ml-0 md:min-w-[9.5rem]">
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
      </div>
    </header>
  );
}
