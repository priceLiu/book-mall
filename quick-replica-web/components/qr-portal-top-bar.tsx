"use client";

import { Sparkles } from "lucide-react";
import { PortalNav } from "@/components/portal-nav";
import { PlatformTopupNavLink } from "@/lib/platform-billing/platform-topup-nav-link";
import { qrLoginHref, qrRegisterHref } from "@/lib/portal-auth-links";
import { getMainSiteOrigin } from "@/lib/site-origin";

type Props = {
  /** 落地页未登录为 false；已登录工作台用各自顶栏 */
  authed?: boolean;
};

/** 落地页顶栏：左侧品牌 · 居中全站门户菜单 · 右侧登录/注册（对齐电商工具箱） */
export function QrPortalTopBar({ authed = false }: Props) {
  const bookOrigin = getMainSiteOrigin();

  return (
    <header
      className="sticky top-0 z-50 shrink-0 border-b border-white/10"
      style={{ background: "var(--qr-bg-page)" }}
    >
      <div className="flex h-12 items-center gap-2 px-3 md:h-14 md:gap-3 md:px-5">
        <div className="flex w-[7.5rem] shrink-0 items-center gap-1.5 sm:w-40">
          <Sparkles
            className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
            style={{ color: "var(--qr-brand)" }}
          />
          <span className="truncate text-sm font-semibold text-[var(--qr-text-primary)]">
            <span className="sm:hidden">快速复刻</span>
            <span className="hidden sm:inline">QuickReplica</span>
          </span>
        </div>

        <div className="flex min-h-[2rem] min-w-0 flex-1 items-center justify-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PortalNav
            current="quick-replica"
            variant="quick-replica"
            bookOrigin={bookOrigin}
            className="shrink-0 whitespace-nowrap"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-2 md:ml-0 md:min-w-[9.5rem]">
          {bookOrigin ? (
            <PlatformTopupNavLink
              bookOrigin={bookOrigin}
              className="qr-btn-secondary !px-3 !py-1.5 !text-xs"
            />
          ) : null}
          {!authed ? (
            <>
              <a href={qrLoginHref("/")} className="qr-btn-secondary !px-3 !py-1.5 !text-xs">
                登录
              </a>
              <a href={qrRegisterHref("/")} className="qr-btn-primary !px-3 !py-1.5 !text-xs">
                免费注册
              </a>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
